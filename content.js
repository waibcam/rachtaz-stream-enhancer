/* ============================================================
   RachtaZ Stream Enhancer — content.js  (v2)
   Detects @RachtaZ VODs, grabs the timecodes posted by
   @Kamille92, then:
     • injects "Previous / Next" buttons into the player
     • draws real chapter markers on the progress bar
     • shows a clickable panel listing every game
     • caches everything per video (instant load on revisits)
   Shortcuts: N (next) · P (previous) · L (game list)
   ============================================================ */

(function () {
  'use strict';

  // ── Configuration ────────────────────────────────────────────────────────
  const CFG = {
    CHANNEL_HANDLE:    'RachtaZ',
    COMMENT_AUTHOR:    'Kamille92',
    MAX_SCAN_ATTEMPTS: 40,        // ~60 s max of searching
    SCAN_INTERVAL_MS:  1500,
    DETECT_TRIES:      8,         // ~5 s to confirm it's a RachtaZ video
    DETECT_STEP_MS:    600,
    UI_HEAL_MS:        1000,      // re-inject our UI if YouTube wipes it
    NEXT_TOLERANCE:    1.5,       // s — avoids sticking to the current timecode
    RESTART_THRESHOLD: 3,         // s — "Previous" restarts the current game
    NUDGE_TICKS:       4,         // extra scroll nudges once comments appear
    SAVE_THROTTLE_MS:  5000,      // how often we persist the playback position
    RESUME_MIN:        60,        // s — don't offer to resume before this point
    RESUME_DIFF:       10,        // s — min gap vs current position to offer resume
    RESUME_SETTLE_MS:  1500,      // let YouTube apply its native resume / t= first
    RESUME_TOAST_MS:   10000,     // how long the resume toast stays visible (10 s)
    LIKE_AFTER_S:      60,        // s of playback before suggesting a like
    LIKE_TOAST_MS:     14000,     // how long the like toast stays visible
    STREAM_MIN_S:      3600,      // min duration to treat a video as a "stream" VOD (>1h)
    SHORT_MAX_S:       180,       // videos this short (Shorts) get no like suggestion
  };

  const CACHE_PREFIX = 'rse_cache_';
  const POS_PREFIX = 'rse_pos_';

  // ── SVG icons ─────────────────────────────────────────────────────────────
  const ICON = {
    prev: '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M6 6h2.2v12H6zM18 6l-8.5 6 8.5 6z"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M6 18l8.5-6L6 6zM15.8 6H18v12h-2.2z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M4 6h16v2H4zM4 11h16v2H4zM4 16h11v2H4z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
  };

  // ── Global state ──────────────────────────────────────────────────────────
  const state = {
    timecodes:    [],    // [{ seconds:Number, label:String }]
    videoId:      null,
    runId:        0,     // anti-race token between fast navigations
    boundVideo:   null,  // <video> element listened to for timeupdate
    uiTimer:      null,  // self-healing interval
    resumeEnabled: true, // "resume playback" toggle (popup setting)
    savedPos:     0,     // last saved playback position for this video (s)
    lastSave:     0,     // timestamp of the last position save (throttle)
    resumeTimer:  null,  // auto-hide timer for the resume toast
    likeEnabled:  true,  // "suggest liking" toggle (popup setting)
    likePrompted: false, // like toast already handled for this video
    likeTimer:    null,  // auto-hide timer for the like toast
    isRachtaz:    false, // current video belongs to RachtaZ
    goldEnabled:  true,  // "gold progress bar" toggle (popup setting)
  };

  // ── Extension-context safety ──────────────────────────────────────────────
  // When the extension is reloaded/updated, content scripts already running in
  // open tabs get "orphaned": every chrome.* call then throws
  // "Extension context invalidated". We detect that and shut down quietly
  // (the page just needs a refresh to pick up the new version).
  let dead = false;
  let navTimer = null;

  function extAlive() {
    return !!(chrome.runtime && chrome.runtime.id);
  }

  function shutdown() {
    if (dead) return;
    dead = true;
    if (state.uiTimer) clearInterval(state.uiTimer);
    if (navTimer) clearInterval(navTimer);
    document.getElementById('rse-controls')?.remove();
    document.getElementById('rse-panel')?.remove();
    document.getElementById('rse-marker-layer')?.remove();
    hideResumeToast();
    hideLikeToast();
  }

  function storageSet(obj) {
    if (dead || !extAlive()) return shutdown();
    try { chrome.storage.local.set(obj); } catch { shutdown(); }
  }
  function storageGet(keys, cb) {
    if (dead || !extAlive()) return shutdown();
    try { chrome.storage.local.get(keys, cb); } catch { shutdown(); }
  }
  function storageRemove(key) {
    if (dead || !extAlive()) return shutdown();
    try { chrome.storage.local.remove(key); } catch { shutdown(); }
  }

  // ── Helpers: timecodes ────────────────────────────────────────────────────

  function tcToSeconds(tc) {
    const parts = tc.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  function secondsToTc(s) {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  }

  /** Extract timecodes from a text block: "HH:MM:SS Label" or "MM:SS Label". */
  function parseTimecodes(text) {
    const regex = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;
    return text
      .split('\n')
      .map((line) => line.trim().match(regex))
      .filter(Boolean)
      .map((m) => ({ seconds: tcToSeconds(m[1]), label: m[2].trim() }))
      .sort((a, b) => a.seconds - b.seconds);
  }

  // ── Timecode navigation ───────────────────────────────────────────────────

  function getVideo() {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  function seekTo(seconds) {
    const v = getVideo();
    if (v) v.currentTime = seconds;
  }

  // ── Shareable per-game links ──────────────────────────────────────────────

  function gameLink(seconds) {
    const id = state.videoId || getVideoId();
    return `https://www.youtube.com/watch?v=${id}&t=${Math.floor(seconds)}s`;
  }

  function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    cb?.();
  }

  function copyGameLink(seconds, btn) {
    const url = gameLink(seconds);
    const done = () => {
      if (!btn) return;
      btn.classList.add('rse-copied');
      btn.innerHTML = ICON.check;
      btn.title = 'Link copied!';
      setTimeout(() => {
        btn.classList.remove('rse-copied');
        btn.innerHTML = ICON.copy;
        btn.title = 'Copy link to this game';
      }, 1300);
    };
    try {
      navigator.clipboard.writeText(url).then(done, () => fallbackCopy(url, done));
    } catch {
      fallbackCopy(url, done);
    }
  }

  function getNextTimecode() {
    const v = getVideo();
    if (!v) return null;
    const t = v.currentTime + CFG.NEXT_TOLERANCE;
    return state.timecodes.find((tc) => tc.seconds > t) || null;
  }

  /** Index of the current game (last timecode <= current position). */
  function currentIndex() {
    const v = getVideo();
    if (!v) return -1;
    const t = v.currentTime + 0.5;
    let idx = -1;
    for (let i = 0; i < state.timecodes.length; i++) {
      if (state.timecodes[i].seconds <= t) idx = i;
      else break;
    }
    return idx;
  }

  /**
   * "Previous": if you're deep into the current game, it restarts it;
   * otherwise it jumps to the start of the previous game.
   */
  function getPrevTimecode() {
    const v = getVideo();
    if (!v) return null;
    const idx = currentIndex();
    if (idx < 0) return null; // before the very first game
    const curStart = state.timecodes[idx].seconds;
    if (v.currentTime - curStart > CFG.RESTART_THRESHOLD) return state.timecodes[idx];
    if (idx - 1 >= 0) return state.timecodes[idx - 1];
    return state.timecodes[0];
  }

  // ── Channel detection ─────────────────────────────────────────────────────

  function isRachtaZVideo() {
    const selectors = [
      '#owner ytd-channel-name a',
      'ytd-video-owner-renderer ytd-channel-name a',
      '#channel-name a',
      'ytd-channel-name a',
    ];
    const handle = CFG.CHANNEL_HANDLE.toLowerCase();
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const txt = el.textContent.trim().toLowerCase();
        const href = (el.href || '').toLowerCase();
        if (txt.includes(handle) || href.includes(handle)) return true;
      }
    }
    return false;
  }

  function getVideoId() {
    try {
      return new URL(location.href).searchParams.get('v');
    } catch {
      return null;
    }
  }

  // ── Cache (per video) ─────────────────────────────────────────────────────

  function cacheKey(id) {
    return CACHE_PREFIX + id;
  }

  function loadCache(id) {
    return new Promise((resolve) => {
      storageGet(cacheKey(id), (d) => resolve(d[cacheKey(id)] || null));
    });
  }

  function saveCache(id, timecodes) {
    if (!id) return;
    storageSet({ [cacheKey(id)]: { timecodes, ts: Date.now() } });
  }

  // ── Playback position (resume) ────────────────────────────────────────────

  function posKey(id) {
    return POS_PREFIX + id;
  }

  /** True when the URL explicitly asks for a start time (t= or start=). */
  function urlHasStartParam() {
    try {
      const p = new URL(location.href).searchParams;
      return p.has('t') || p.has('start');
    } catch {
      return false;
    }
  }

  /** Persist the current playback position for this video (or clear it if ended). */
  function savePosNow() {
    if (!state.resumeEnabled || !state.videoId) return;
    const v = getVideo();
    if (!v) return;
    const t = v.currentTime;
    const dur = v.duration || 0;
    if (!isFinite(t) || t < 5) return;                 // nothing meaningful yet
    if (dur && t > dur - 10) {                          // basically finished → clear
      storageRemove(posKey(state.videoId));
      state.savedPos = 0;
      return;
    }
    state.savedPos = t;
    storageSet({ [posKey(state.videoId)]: { time: t, dur, ts: Date.now() } });
  }

  function maybeSavePos() {
    const now = Date.now();
    if (now - state.lastSave < CFG.SAVE_THROTTLE_MS) return;
    state.lastSave = now;
    savePosNow();
  }

  /** Keep the stored positions bounded (oldest dropped). Runs once at startup. */
  function prunePositions(max) {
    storageGet(null, (all) => {
      const keys = Object.keys(all).filter((k) => k.startsWith(POS_PREFIX));
      if (keys.length <= max) return;
      keys
        .map((k) => ({ k, ts: all[k]?.ts || 0 }))
        .sort((a, b) => a.ts - b.ts)
        .slice(0, keys.length - max)
        .forEach(({ k }) => storageRemove(k));
    });
  }

  // ── Comment scraping ──────────────────────────────────────────────────────

  function scanCommentsInDOM() {
    const author = CFG.COMMENT_AUTHOR.toLowerCase();
    const threads = document.querySelectorAll('ytd-comment-thread-renderer');
    for (const thread of threads) {
      const authorEl =
        thread.querySelector('#author-text span') || thread.querySelector('#author-text');
      if (!authorEl) continue;
      if (authorEl.textContent.trim().toLowerCase().includes(author)) {
        const contentEl = thread.querySelector('#content-text');
        if (contentEl) return contentEl.textContent.trim();
      }
    }
    return null;
  }

  function nudgeScrollToComments() {
    const comments =
      document.querySelector('ytd-comments') || document.querySelector('#comments');
    if (comments) comments.scrollIntoView({ block: 'center' });
    else window.scrollBy({ top: 800 });
  }

  /**
   * Look for @Kamille92's comment. Two cooperating mechanisms:
   *   • a MutationObserver on the comments area → INSTANT detection
   *     (it only ever "checks now", it never touches the retry budget)
   *   • a timed loop that owns the retry counter and the scroll nudging,
   *     forcing YouTube's lazy-loaded comments to render
   * The user's scroll position is restored at the end.
   */
  function startScan(myRun) {
    updateIndicator('loading');
    const origScroll = window.scrollY;
    let attempts = 0;
    let done = false;
    let timer = null;
    let observer = null;

    const cleanup = () => {
      done = true;
      if (timer) { clearTimeout(timer); timer = null; }
      if (observer) { observer.disconnect(); observer = null; }
    };

    // Check ONCE. Returns true when the search is over (found, or found but no
    // timecodes). Never increments the counter, never schedules a timer.
    const checkOnce = () => {
      if (done || myRun !== state.runId) { cleanup(); return true; }
      const txt = scanCommentsInDOM();
      if (!txt) return false;
      const parsed = parseTimecodes(txt);
      cleanup();
      window.scrollTo({ top: origScroll });
      if (parsed.length) {
        applyTimecodes(parsed, false);
        saveCache(state.videoId, parsed);
      } else {
        log("@Kamille92's comment found but without timecodes.");
        updateIndicator('no-timecodes');
      }
      return true;
    };

    // Timed loop: the ONLY place that spends the retry budget and scrolls.
    const tick = () => {
      if (done || myRun !== state.runId) return cleanup();
      if (checkOnce()) return;

      if (attempts >= CFG.MAX_SCAN_ATTEMPTS) {
        cleanup();
        window.scrollTo({ top: origScroll });
        log('Comment not found (retries exhausted).');
        updateIndicator('not-found');
        return;
      }

      // Keep nudging while comments aren't loaded yet (+ a few extra nudges).
      const loaded = document.querySelector('ytd-comment-thread-renderer');
      if (!loaded || attempts < CFG.NUDGE_TICKS) nudgeScrollToComments();

      attempts++;
      timer = setTimeout(tick, CFG.SCAN_INTERVAL_MS);
    };

    // Observer only triggers an instant check — no counter, no timer.
    const section =
      document.querySelector('ytd-comments') || document.querySelector('#comments');
    if (section) {
      observer = new MutationObserver(() => { checkOnce(); });
      observer.observe(section, { childList: true, subtree: true });
    }

    tick();
  }

  // ── Apply timecodes + start the UI ────────────────────────────────────────

  function applyTimecodes(timecodes, fromCache) {
    state.timecodes = timecodes;
    log(`${timecodes.length} timecode(s) ${fromCache ? '(cache)' : 'found'}.`);

    ensureUI();
    startUiHeal();

    storageSet({
      rse_status: 'found',
      rse_timecode_count: timecodes.length,
      rse_timecodes: timecodes.map((t) => ({ s: t.seconds, l: t.label })),
      rse_video_id: state.videoId,
    });
  }

  // ── UI: player buttons ────────────────────────────────────────────────────

  function mkIconButton(id, svg, title, onClick) {
    const b = document.createElement('button');
    b.id = id;
    b.className = 'ytp-button rse-icon-btn';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = svg;
    b.addEventListener('click', onClick);
    return b;
  }

  function injectControls() {
    const left = document.querySelector('.ytp-left-controls');
    if (!left) return false;
    if (document.getElementById('rse-controls')) return true;

    const wrap = document.createElement('div');
    wrap.id = 'rse-controls';
    wrap.className = 'rse-controls';

    const prev = mkIconButton('rse-prev-btn', ICON.prev, 'Previous game (P)', goToPrev);

    const next = document.createElement('button');
    next.id = 'rse-next-btn';
    next.className = 'ytp-button rse-next-btn';
    next.setAttribute('aria-keyshortcuts', 'n');
    next.innerHTML =
      `<span class="rse-skip-icon">${ICON.next}</span>` +
      `<span class="rse-next-label" aria-live="polite"></span>`;
    next.addEventListener('click', goToNext);

    const toggle = mkIconButton('rse-toggle-btn', ICON.list, 'Game list (L)', () => togglePanel());

    wrap.append(prev, next, toggle);

    const anchor =
      left.querySelector('.ytp-next-button') || left.querySelector('.ytp-play-button');
    if (anchor && anchor.nextSibling) left.insertBefore(wrap, anchor.nextSibling);
    else left.appendChild(wrap);

    updateControls();
    return true;
  }

  function setDisabled(btn, disabled) {
    if (!btn) return;
    btn.disabled = disabled;
    btn.classList.toggle('rse-disabled', disabled);
  }

  function updateControls() {
    const nextBtn = document.getElementById('rse-next-btn');
    if (nextBtn) {
      const label = nextBtn.querySelector('.rse-next-label');
      const next = getNextTimecode();
      if (next) {
        if (label) label.textContent = `Next — ${next.label}`;
        nextBtn.title = `Go to "${next.label}" (N)`;
        setDisabled(nextBtn, false);
      } else {
        if (label) label.textContent = 'End';
        nextBtn.title = 'Last game reached';
        setDisabled(nextBtn, true);
      }
    }

    const prevBtn = document.getElementById('rse-prev-btn');
    if (prevBtn) {
      const prev = getPrevTimecode();
      if (prev) {
        prevBtn.title = `Previous — "${prev.label}" (P)`;
        setDisabled(prevBtn, false);
      } else {
        prevBtn.title = 'Start of video';
        setDisabled(prevBtn, true);
      }
    }

    updatePanelActive();
  }

  function pulse(btn) {
    if (!btn) return;
    btn.classList.remove('rse-pulse');
    void btn.offsetWidth; // restart the animation
    btn.classList.add('rse-pulse');
  }

  function goToNext() {
    const next = getNextTimecode();
    if (next) {
      seekTo(next.seconds);
      pulse(document.getElementById('rse-next-btn'));
      updateControls();
    }
  }

  function goToPrev() {
    const prev = getPrevTimecode();
    if (prev) {
      seekTo(prev.seconds);
      pulse(document.getElementById('rse-prev-btn'));
      updateControls();
    }
  }

  // ── UI: game list panel ───────────────────────────────────────────────────

  function getPlayer() {
    return document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  }

  function buildPanel() {
    const player = getPlayer();
    if (!player) return;
    if (document.getElementById('rse-panel')) {
      renderPanelList();
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'rse-panel';
    panel.className = 'rse-panel rse-hidden';
    panel.innerHTML =
      '<div class="rse-panel-head">' +
        `<span class="rse-panel-title">🎮 Games · ${state.timecodes.length}</span>` +
        '<button class="rse-panel-close" title="Close (L)" aria-label="Close">✕</button>' +
      '</div>' +
      '<ul class="rse-panel-list"></ul>';
    panel.querySelector('.rse-panel-close').addEventListener('click', () => togglePanel(false));
    player.appendChild(panel);
    renderPanelList();
  }

  function renderPanelList() {
    const ul = document.querySelector('#rse-panel .rse-panel-list');
    if (!ul) return;
    ul.innerHTML = '';
    state.timecodes.forEach((tc, i) => {
      const li = document.createElement('li');
      li.className = 'rse-panel-item';
      li.dataset.idx = String(i);
      li.innerHTML =
        `<span class="rse-item-num">${i + 1}</span>` +
        `<span class="rse-item-time">${secondsToTc(tc.seconds)}</span>` +
        '<span class="rse-item-label"></span>' +
        `<button class="rse-item-copy" title="Copy link to this game" aria-label="Copy link">${ICON.copy}</button>`;
      li.querySelector('.rse-item-label').textContent = tc.label;
      li.addEventListener('click', () => {
        seekTo(tc.seconds);
        updateControls();
      });
      const copyBtn = li.querySelector('.rse-item-copy');
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyGameLink(tc.seconds, copyBtn);
      });
      ul.appendChild(li);
    });
    updatePanelActive();
  }

  function updatePanelActive() {
    const idx = currentIndex();
    const items = document.querySelectorAll('#rse-panel .rse-panel-item');
    items.forEach((li, i) => li.classList.toggle('rse-active', i === idx));
  }

  function togglePanel(force) {
    if (!document.getElementById('rse-panel')) buildPanel();
    const panel = document.getElementById('rse-panel');
    if (!panel) return;
    const show = typeof force === 'boolean' ? force : panel.classList.contains('rse-hidden');
    panel.classList.toggle('rse-hidden', !show);
    const toggle = document.getElementById('rse-toggle-btn');
    if (toggle) toggle.classList.toggle('rse-on', show);
    if (show) {
      updatePanelActive();
      const active = panel.querySelector('.rse-active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }
  }

  // ── UI: chapter markers on the progress bar ───────────────────────────────

  function renderMarkers() {
    const bar = document.querySelector('.ytp-progress-bar');
    const v = getVideo();
    if (!bar || !v) return;

    const dur = v.duration;
    if (!isFinite(dur) || dur <= 0) {
      v.addEventListener('loadedmetadata', renderMarkers, { once: true });
      return;
    }

    let layer = document.getElementById('rse-marker-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'rse-marker-layer';
      layer.className = 'rse-marker-layer';
      bar.appendChild(layer);
    }
    layer.innerHTML = '';

    state.timecodes.forEach((tc) => {
      if (tc.seconds <= 0 || tc.seconds > dur) return;
      const m = document.createElement('div');
      m.className = 'rse-marker';
      m.style.left = (tc.seconds / dur) * 100 + '%';
      m.title = `${secondsToTc(tc.seconds)} — ${tc.label}`;
      layer.appendChild(m);
    });
  }

  // ── Real-time sync ────────────────────────────────────────────────────────

  function onTimeUpdate() {
    if (dead) return;
    if (state.timecodes.length) {     // stream-only: nav labels + resume position
      updateControls();
      maybeSavePos();
    }
    maybeOfferLike();                 // all RachtaZ videos
  }

  function bindTimeUpdate() {
    const v = getVideo();
    if (!v || state.boundVideo === v) return;
    if (state.boundVideo) state.boundVideo.removeEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('timeupdate', onTimeUpdate);
    state.boundVideo = v;
  }

  /**
   * Self-healing: YouTube regularly rebuilds its controls (fullscreen,
   * theater, ads…). Make sure our UI is still present.
   */
  function ensureUI() {
    if (dead) return;
    bindTimeUpdate();                 // powers the like suggestion on ALL videos
    if (!state.timecodes.length) return; // the rest (timecode UI) is stream-only
    injectControls();
    if (!document.getElementById('rse-panel')) buildPanel();
    const layer = document.getElementById('rse-marker-layer');
    if (!layer || !layer.children.length) renderMarkers();
  }

  function startUiHeal() {
    if (!state.uiTimer) state.uiTimer = setInterval(ensureUI, CFG.UI_HEAL_MS);
  }

  // ── Resume toast (click-to-jump, no auto-seek = no conflict with YouTube) ──

  function hideResumeToast() {
    if (state.resumeTimer) { clearTimeout(state.resumeTimer); state.resumeTimer = null; }
    document.getElementById('rse-resume')?.remove();
  }

  function showResumeToast(pos) {
    const player = getPlayer();
    if (!player) return;
    hideResumeToast();

    const el = document.createElement('div');
    el.id = 'rse-resume';
    el.className = 'rse-resume';
    el.innerHTML =
      `<span class="rse-resume-txt">↩ Resume at <b>${secondsToTc(pos)}</b></span>` +
      '<button class="rse-resume-go">Resume</button>' +
      '<button class="rse-resume-x" title="Dismiss" aria-label="Dismiss">✕</button>';
    el.querySelector('.rse-resume-go').addEventListener('click', () => {
      seekTo(pos);
      updateControls();
      hideResumeToast();
    });
    el.querySelector('.rse-resume-x').addEventListener('click', hideResumeToast);
    player.appendChild(el);
    state.resumeTimer = setTimeout(hideResumeToast, CFG.RESUME_TOAST_MS);
  }

  /**
   * Offer to resume — only via a button, never by force-seeking.
   * Waits for metadata, lets YouTube apply its own resume/t= first, then offers
   * our (precise) position if it differs enough from where the player landed.
   */
  function offerResume(myRun) {
    const v = getVideo();
    if (!v) return;
    if (!isFinite(v.duration) || v.duration <= 0) {
      v.addEventListener('loadedmetadata', () => {
        if (myRun === state.runId) offerResume(myRun);
      }, { once: true });
      return;
    }
    const pos = state.savedPos;
    if (pos < CFG.RESUME_MIN || pos > v.duration - 15) return;

    setTimeout(() => {
      if (myRun !== state.runId || !state.resumeEnabled) return;
      if (urlHasStartParam()) return;                 // explicit start time wins
      const cur = getVideo()?.currentTime ?? 0;
      if (Math.abs(cur - pos) < CFG.RESUME_DIFF) return; // already at the spot
      showResumeToast(pos);
    }, CFG.RESUME_SETTLE_MS);
  }

  /** Load the resume/like settings + saved position, then maybe offer to resume. */
  function setupResume(myRun) {
    storageGet(
      ['rse_resume_enabled', 'rse_like_enabled', 'rse_gold_enabled', posKey(state.videoId)],
      (d) => {
        if (myRun !== state.runId) return;
        state.resumeEnabled = d.rse_resume_enabled !== false; // default ON
        state.likeEnabled = d.rse_like_enabled !== false;     // default ON
        state.goldEnabled = d.rse_gold_enabled !== false;     // default ON
        state.savedPos = d[posKey(state.videoId)]?.time || 0;
        applyGoldTheme();
        if (state.resumeEnabled && !urlHasStartParam() && state.savedPos >= CFG.RESUME_MIN) {
          offerResume(myRun);
        }
      },
    );
  }

  // ── Like suggestion (one-click, never automatic) ──────────────────────────

  /** Find YouTube's "like" button across DOM versions. */
  function getLikeButton() {
    const modern = document.querySelector('like-button-view-model button');
    if (modern) return modern;
    const seg = document.querySelector(
      '#segmented-like-button button, ytd-segmented-like-dislike-button-renderer #like-button button',
    );
    if (seg) return seg;
    const legacy = document.querySelector(
      '#top-level-buttons-computed ytd-toggle-button-renderer button, #menu ytd-toggle-button-renderer button',
    );
    if (legacy) return legacy;
    const scope = document.querySelector('ytd-watch-metadata, #actions, #menu') || document;
    for (const b of scope.querySelectorAll('button[aria-pressed]')) {
      const al = (b.getAttribute('aria-label') || '').toLowerCase();
      if (/dislike|n['’]aime pas/.test(al)) continue;
      if (/\blike\b|j['’]aime|me gusta|gefällt/.test(al)) return b;
    }
    return null;
  }

  function isLiked(btn) {
    if (!btn) return false;
    if (btn.getAttribute('aria-pressed') === 'true') return true;
    const r = btn.closest('ytd-toggle-button-renderer, like-button-view-model, toggle-button-view-model');
    if (r && r.getAttribute('aria-pressed') === 'true') return true;
    if (r && /style-default-active/.test(r.className)) return true; // legacy liked state
    return false;
  }

  function doLike() {
    const btn = getLikeButton();
    if (btn && !isLiked(btn)) btn.click(); // user-initiated click only
  }

  function hideLikeToast() {
    if (state.likeTimer) { clearTimeout(state.likeTimer); state.likeTimer = null; }
    document.getElementById('rse-like')?.remove();
  }

  function showLikeToast() {
    const player = getPlayer();
    if (!player) return;
    hideLikeToast();
    const el = document.createElement('div');
    el.id = 'rse-like';
    el.className = 'rse-like';
    el.innerHTML =
      '<span class="rse-like-txt">Enjoying it? <b>Like RachtaZ\'s video</b></span>' +
      '<button class="rse-like-go">👍 Like</button>' +
      '<button class="rse-like-x" title="Dismiss" aria-label="Dismiss">✕</button>';
    el.querySelector('.rse-like-go').addEventListener('click', () => { doLike(); hideLikeToast(); });
    el.querySelector('.rse-like-x').addEventListener('click', hideLikeToast);
    player.appendChild(el);
    state.likeTimer = setTimeout(hideLikeToast, CFG.LIKE_TOAST_MS);
  }

  /** After a genuine bit of watching, suggest liking — once, and never if already liked. */
  function maybeOfferLike() {
    if (!state.likeEnabled || state.likePrompted) return;
    if (location.pathname.startsWith('/shorts/')) return;   // never on Shorts
    const v = getVideo();
    if (!v || v.currentTime < CFG.LIKE_AFTER_S) return;
    if (isFinite(v.duration) && v.duration > 0 && v.duration <= CFG.SHORT_MAX_S) return; // Short via /watch
    const btn = getLikeButton();
    if (!btn) return;                  // not ready / signed out → don't nag
    state.likePrompted = true;
    if (isLiked(btn)) return;          // already liked → nothing to do
    showLikeToast();
  }

  // ── Indicator (popup) ─────────────────────────────────────────────────────

  function updateIndicator(status) {
    storageSet({ rse_status: status });
  }

  // ── RachtaZ gold progress bar ─────────────────────────────────────────────
  // Tints YouTube's native seek bar gold, but ONLY on RachtaZ videos (the class
  // is scoped on <html>, so it never affects other channels).
  function applyGoldTheme() {
    document.documentElement.classList.toggle(
      'rse-rachtaz',
      state.isRachtaz && state.goldEnabled,
    );
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  // Capture phase + stopImmediatePropagation so YouTube doesn't also act on the
  // key (notably its own `l` = seek +10 s). Only the keys we handle are stopped,
  // and only on streams (timecodes present) — never while typing.
  document.addEventListener('keydown', (e) => {
    if (!state.timecodes.length) return;
    const ae = document.activeElement;
    const tag = ae?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || ae?.isContentEditable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const k = e.key.toLowerCase();
    if (k !== 'n' && k !== 'p' && k !== 'l') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (k === 'n') goToNext();
    else if (k === 'p') goToPrev();
    else togglePanel();
  }, true);

  // ── Messages from the popup ───────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'rse-rescan') {
      if (state.videoId) storageRemove(cacheKey(state.videoId));
      init();
      sendResponse?.({ ok: true });
    } else if (msg.type === 'rse-seek' && typeof msg.seconds === 'number') {
      seekTo(msg.seconds);
      updateControls();
      sendResponse?.({ ok: true });
    }
    return true;
  });

  // React live to the toggles changed from the popup.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.rse_resume_enabled) {
      state.resumeEnabled = changes.rse_resume_enabled.newValue !== false;
      if (!state.resumeEnabled) hideResumeToast();
    }
    if (changes.rse_like_enabled) {
      state.likeEnabled = changes.rse_like_enabled.newValue !== false;
      if (!state.likeEnabled) hideLikeToast();
    }
    if (changes.rse_gold_enabled) {
      state.goldEnabled = changes.rse_gold_enabled.newValue !== false;
      applyGoldTheme();
    }
  });

  // Persist the playback position when the tab is hidden or closed.
  window.addEventListener('pagehide', savePosNow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) savePosNow();
  });

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    if (state.uiTimer) clearInterval(state.uiTimer);
    document.getElementById('rse-controls')?.remove();
    document.getElementById('rse-panel')?.remove();
    document.getElementById('rse-marker-layer')?.remove();
    hideResumeToast();
    hideLikeToast();
    if (state.boundVideo) {
      state.boundVideo.removeEventListener('timeupdate', onTimeUpdate);
      state.boundVideo = null;
    }
    state.timecodes = [];
    state.uiTimer = null;
    state.savedPos = 0;
    state.lastSave = 0;
    state.likePrompted = false;
    state.isRachtaz = false;
    applyGoldTheme();             // remove the gold tint when leaving RachtaZ
    updateIndicator('idle');
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function log(msg) {
    console.log(`[RSE] ${msg}`);
  }

  function waitForRachtaZ(myRun, tries, cb) {
    if (myRun !== state.runId) return;
    if (isRachtaZVideo()) return cb(true);
    if (tries <= 0) return cb(false);
    setTimeout(() => waitForRachtaZ(myRun, tries - 1, cb), CFG.DETECT_STEP_MS);
  }

  /**
   * Scan @Kamille92's comment for timecodes ONLY on streams (long VODs).
   * Normal RachtaZ videos are left alone (no comment scan, no scrolling) — only
   * the like suggestion runs there.
   */
  function maybeScanIfStream(myRun) {
    if (myRun !== state.runId) return;
    const v = getVideo();
    if (!v) {
      setTimeout(() => maybeScanIfStream(myRun), 500);
      return;
    }
    if (!isFinite(v.duration) || v.duration <= 0) {
      v.addEventListener('loadedmetadata', () => {
        if (myRun === state.runId) maybeScanIfStream(myRun);
      }, { once: true });
      return;
    }
    if (v.duration < CFG.STREAM_MIN_S) {
      log('Normal video (short) — skipping timecode scan.');
      updateIndicator('not-stream');
      return;
    }
    startScan(myRun);
  }

  function init() {
    if (!location.href.includes('youtube.com/watch')) {
      reset();
      return;
    }

    reset();
    const myRun = ++state.runId;
    state.videoId = getVideoId();
    updateIndicator('loading');

    waitForRachtaZ(myRun, CFG.DETECT_TRIES, (ok) => {
      if (myRun !== state.runId) return;
      if (!ok) {
        log('Not a RachtaZ video — extension inactive.');
        updateIndicator('not-rachtaz');
        return;
      }
      log('RachtaZ video detected!');
      state.isRachtaz = true;
      applyGoldTheme();           // tint the seek bar gold right away
      setupResume(myRun);
      startUiHeal();              // powers the like suggestion even without timecodes

      if (state.videoId) {
        loadCache(state.videoId).then((cached) => {
          if (myRun !== state.runId) return;
          if (cached?.timecodes?.length) applyTimecodes(cached.timecodes, true);
          else maybeScanIfStream(myRun);
        });
      } else {
        maybeScanIfStream(myRun);
      }
    });
  }

  // ── YouTube SPA navigation ────────────────────────────────────────────────
  // YouTube fires `yt-navigate-finish` on every internal page change.
  // We listen on document AND window, with a URL-based safety net.
  let lastUrl = location.href;
  const onNav = () => {
    if (dead) return;
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    log(`Navigation detected → ${lastUrl}`);
    init();
  };
  document.addEventListener('yt-navigate-finish', onNav);
  window.addEventListener('yt-navigate-finish', onNav);
  navTimer = setInterval(onNav, 1000); // lightweight fallback (string compare)

  // Keep stored playback positions bounded.
  prunePositions(300);

  // Initial start
  init();

})();
