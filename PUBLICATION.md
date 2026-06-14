# 📋 Store-listing sheet — RachtaZ Stream Enhancer v1.0.0

All the text below is **ready to copy-paste**. Sections shared across the stores
first, then each store's specifics.

---

## 0. Before you submit — checklist

- [ ] RachtaZ's (written) consent to use his **name** + **avatar** → keep a screenshot
- [ ] Developer account created on each store (see fees below)
- [ ] Privacy policy hosted online (see `PRIVACY.md`) → public URL
- [ ] 2-3 screenshots (see §6)
- [ ] Packages built: `python build.py` → `dist/` folder

| Store | Account | Fee | URL |
|---|---|---|---|
| Chrome Web Store | Google | **$5 one-time** | https://chrome.google.com/webstore/devconsole |
| Microsoft Edge Add-ons | Microsoft | **free** | https://partner.microsoft.com/dashboard/microsoftedge |
| Opera add-ons | Opera | **free** | https://addons.opera.com/developer/ |
| Firefox AMO | Mozilla | **free** | https://addons.mozilla.org/developers/ |

> Opera also accepts the Chromium package, and Opera users can even install
> straight from the Chrome Web Store via Opera's "Install Chrome Extensions" addon —
> so publishing to the Opera store is optional.

---

## 1. Identity

| Field | Value |
|---|---|
| **Name** | RachtaZ Stream Enhancer |
| **Version** | 1.0.0 |
| **Publisher / Author** | Kamille92 |
| **Primary language** | English |
| **Category (Chrome / Edge / Opera)** | Productivity |
| **Category (Firefox)** | Photos, Music & Videos |
| **Website / Homepage** | https://github.com/waibcam/rachtaz-stream-enhancer |
| **Support URL** | https://github.com/waibcam/rachtaz-stream-enhancer/issues |
| **Privacy policy** | https://github.com/waibcam/rachtaz-stream-enhancer/blob/main/PRIVACY.md |

---

## 2. Short description / summary

> Limits: Chrome ≤ 132 chars · Firefox ≤ 250 · Edge/Opera short.

```
Fan-made (unofficial) - timecode navigation for RachtaZ VODs: timeline chapters, game list, N/P/L shortcuts.
```

---

## 3. Long description (paste into "Detailed description")

```
🎮 RachtaZ Stream Enhancer — navigate VODs like a game menu

Tired of scrolling by hand to find Game 7 in a 6-hour VOD? This extension turns
the timecodes posted by @Kamille92 in the comments into real chapters, right
inside the YouTube player.

✨ FEATURES
• Chapter markers on the progress bar — see at a glance where each game starts
• Clickable game list (press L) — jump straight to any game
• "Previous" / "Next" buttons added to the player
• Keyboard shortcuts: N (next), P (previous), L (list)
• Shareable game links — one click copies a timestamped URL to share a moment
• Gold seek bar on RachtaZ videos — timestamps pop and you see the extension is on
• Instant load when you revisit a VOD you've already opened (local cache)
• Resume playback: a one-click "Resume" button brings you back to where you
  left off — precise, and it never overrides shared timestamped links

⚡ HOW IT WORKS
1. Open a RachtaZ stream VOD on YouTube
2. The extension automatically finds @Kamille92's comment with the timecodes
3. Navigate: click a game in the list, use the player buttons, or the shortcuts

🔒 PRIVACY
No data collected, nothing sent anywhere. Timecodes are stored locally in your
browser only.

⚠️ Unofficial fan-made project, not affiliated with RachtaZ. Works only on the
RachtaZ channel's videos.
```

---

## 4. Permission justifications (required by Chrome, useful for the others)

| Permission | Justification to paste |
|---|---|
| `storage` | Store the detected timecodes, status and last playback position locally, for instant loading and resume when revisiting a video. No data is transmitted. |
| `host_permissions`: `https://www.youtube.com/*` | The script runs on YouTube watch pages to read the timecodes from the comments, inject the navigation buttons/markers, and lets the popup talk to that tab. |

> Note: no `activeTab`, `tabs`, or remote-host permissions are requested — the
> popup↔page messaging is covered by the single YouTube host permission.

**Single purpose (Chrome):**
```
Make it easy to navigate the RachtaZ YouTube channel's VODs by chapters/timecodes
and resume playback where you left off.
```

---

## 5. Data declaration (Chrome "Privacy" / Edge / Opera / Firefox)

- Personal data collected: **None**
- Data sent to third parties: **None**
- Data sold: **No**
- Tick the 3 Chrome certifications:
  - [x] I do not sell or transfer user data to third parties (outside approved use cases)
  - [x] I do not use or transfer user data for purposes unrelated to the single purpose
  - [x] I do not use or transfer user data to determine creditworthiness / for lending
- `storage` usage: **local** storage only (timecode cache + playback position for resume + 3 on/off toggles).

---

## 6. Screenshots

> Chrome/Edge/Opera: **1280×800** (or 640×400), PNG/JPEG, 1 to 5 images.
> Firefox: any size, landscape recommended.

Suggested shot list (on a real RachtaZ stream VOD):

1. **Player + timeline** — the "◀ / ⏭ Next — Game X" buttons, the **gold** seek bar
   and the red markers on the progress bar.
   _Caption: "Chapters right on the timeline"_
2. **Game panel open** (press L) — clickable list, current game highlighted, copy-link buttons.
   _Caption: "Jump to (or share) any game in one click"_
3. **Extension popup** — "Timecodes loaded" status + list + shortcuts + toggles.
   _Caption: "Status, quick navigation and settings"_

---

## 7. Review pitfalls to anticipate

- **Branding/trademark**: using the "RachtaZ" name and his avatar can trigger an
  "impersonation" rejection if you don't have his consent. Keep proof of his
  authorization; the "unofficial / fan-made" wording is already present everywhere.
- **Firefox**: the code is not minified → no source archive to provide. The gecko
  ID **and** the required `data_collection_permissions: { required: ["none"] }`
  (Firefox's built-in data consent — we collect nothing) are injected by `build.py`.
- **Edge / Opera**: both accept the Chromium (`chrome-edge`) package directly. Same
  listing text as Chrome.
- **Consistency**: the same name, icon and description across the stores reduces
  review friction.
- **Like button**: the extension **never likes automatically**. It only shows a
  discreet one-click suggestion *after* the user has watched for a while, and only
  if the video isn't already liked — the like happens solely on the user's click.
  State this clearly if a reviewer asks: it does not automate engagement.

---

## 8. Packages to upload (generated by `python build.py`)

| Store | File |
|---|---|
| Chrome Web Store | `dist/rachtaz-stream-enhancer-chrome-edge-v<version>.zip` |
| Microsoft Edge Add-ons | `dist/rachtaz-stream-enhancer-chrome-edge-v<version>.zip` |
| Opera add-ons | `dist/rachtaz-stream-enhancer-chrome-edge-v<version>.zip` |
| Firefox AMO | `dist/rachtaz-stream-enhancer-firefox-v<version>.zip` |
