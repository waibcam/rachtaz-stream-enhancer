/* ============================================================
   RachtaZ Stream Enhancer — popup.js  (v2)
   Shows the status + the clickable game list, and lets you
   trigger a fresh scan.
   ============================================================ */

const STATUSES = {
  idle: {
    icon: '💤', label: 'Idle',
    desc: 'Open a YouTube video to get started.', cls: 'status-idle',
  },
  loading: {
    icon: '🔍', label: 'Searching…',
    desc: 'Scanning the comments for timecodes.', cls: 'status-loading',
  },
  found: {
    icon: '✅', label: 'Timecodes loaded!',
    desc: 'Navigation active. Shortcuts: N · P · L.', cls: 'status-found',
  },
  'not-found': {
    icon: '⚠️', label: 'Comment not found',
    desc: 'No @Kamille92 comment with timecodes was found.', cls: 'status-not-found',
  },
  'no-timecodes': {
    icon: '⚠️', label: 'No timecodes',
    desc: 'Comment found but no timecode detected.', cls: 'status-not-found',
  },
  'not-rachtaz': {
    icon: '🚫', label: 'Not a RachtaZ video',
    desc: 'The extension is inactive on this video.', cls: 'status-error',
  },
  'not-stream': {
    icon: '🎬', label: 'Normal RachtaZ video',
    desc: 'Timecode navigation is for streams only. Like suggestion is active.', cls: 'status-idle',
  },
};

function applyStatus(key) {
  const cfg = STATUSES[key] || STATUSES.idle;
  document.getElementById('status-card').className = `status-card ${cfg.cls}`;
  document.getElementById('status-icon').textContent = cfg.icon;
  document.getElementById('status-label').textContent = cfg.label;
  document.getElementById('status-desc').textContent = cfg.desc;
}

function secondsToTc(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function sendToActiveTab(msg, cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, msg, () => {
        // Silently ignore the error if no content script is listening.
        void chrome.runtime.lastError;
        cb?.();
      });
    }
  });
}

const COPY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

let currentVideoId = null;

function copyLink(seconds, btn) {
  if (!currentVideoId) return;
  const url = `https://www.youtube.com/watch?v=${currentVideoId}&t=${Math.floor(seconds)}s`;
  navigator.clipboard.writeText(url).finally(() => {
    btn.classList.add('copied');
    btn.innerHTML = CHECK_SVG;
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = COPY_SVG; }, 1300);
  });
}

function renderGames(timecodes) {
  const wrap = document.getElementById('games-wrap');
  const list = document.getElementById('games-list');
  if (!timecodes || !timecodes.length) {
    wrap.style.display = 'none';
    return;
  }
  document.getElementById('games-count').textContent = timecodes.length;
  list.innerHTML = '';
  timecodes.forEach((tc, i) => {
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="g-num">${i + 1}</span>` +
      `<span class="g-time">${secondsToTc(tc.s)}</span>` +
      '<span class="g-label"></span>' +
      `<button class="g-copy" title="Copy link to this game" aria-label="Copy link">${COPY_SVG}</button>`;
    li.querySelector('.g-label').textContent = tc.l;
    li.title = `Jump to "${tc.l}"`;
    li.addEventListener('click', () => {
      sendToActiveTab({ type: 'rse-seek', seconds: tc.s }, () => window.close());
    });
    const copyBtn = li.querySelector('.g-copy');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyLink(tc.s, copyBtn);
    });
    list.appendChild(li);
  });
  wrap.style.display = 'block';
}

function refresh() {
  chrome.storage.local.get(['rse_status', 'rse_timecodes', 'rse_video_id'], (data) => {
    currentVideoId = data.rse_video_id || null;
    applyStatus(data.rse_status || 'idle');
    renderGames(data.rse_timecodes);
  });
}

// "Rescan" button
document.getElementById('rescan-btn').addEventListener('click', () => {
  applyStatus('loading');
  document.getElementById('games-wrap').style.display = 'none';
  sendToActiveTab({ type: 'rse-rescan' });
});

// Setting toggles (default ON)
const resumeToggle = document.getElementById('resume-toggle');
const likeToggle = document.getElementById('like-toggle');
const goldToggle = document.getElementById('gold-toggle');
chrome.storage.local.get(['rse_resume_enabled', 'rse_like_enabled', 'rse_gold_enabled'], (d) => {
  resumeToggle.checked = d.rse_resume_enabled !== false;
  likeToggle.checked = d.rse_like_enabled !== false;
  goldToggle.checked = d.rse_gold_enabled !== false;
});
resumeToggle.addEventListener('change', () => {
  chrome.storage.local.set({ rse_resume_enabled: resumeToggle.checked });
});
likeToggle.addEventListener('change', () => {
  chrome.storage.local.set({ rse_like_enabled: likeToggle.checked });
});
goldToggle.addEventListener('change', () => {
  chrome.storage.local.set({ rse_gold_enabled: goldToggle.checked });
});

// Live update while the popup is open (ignore noisy position saves).
chrome.storage.onChanged.addListener((changes) => {
  if (changes.rse_status || changes.rse_timecodes) refresh();
});

refresh();
