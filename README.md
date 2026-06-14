# 🎮 RachtaZ Stream Enhancer

> ⚠️ **Fan-made, unofficial project**, created by **@Kamille92** and **not affiliated** with RachtaZ. The channel name and avatar are used for navigation/illustration purposes only.

Browser extension to easily navigate [@RachtaZ](https://www.youtube.com/@RachtaZ) VODs using the timecodes posted in the comments by **@Kamille92**.

---

## ✨ Features

- **Automatic detection** of @RachtaZ videos
- **Comment scanning** to find @Kamille92's timecode comment
- **Gold seek bar**: RachtaZ's gold tints the native YouTube progress bar — only on his videos — so timestamps pop and you can see the extension is active. Toggle in the popup.
- **Real chapter markers on the timeline**: one red marker per game on the progress bar
- **"Games" panel**: the full clickable list of games — jump straight to any of them (the current game is highlighted)
- **Shareable game links**: a copy button on each game (panel + popup) copies a timestamped URL (`…/watch?v=…&t=…s`) to share a precise moment
- **Player buttons**: `◀ Previous` and `⏭ Next — [Game]`
- **Keyboard shortcuts**: `N` (next) · `P` (previous) · `L` (open/close the list)
- **Per-video cache**: when you reopen a VOD you've already visited, timecodes load **instantly** (no rescanning)
- **Resume playback**: a discreet "↩ Resume at HH:MM:SS" button on reopening — precise, click-to-jump, never fights YouTube (respects `t=` links). Toggle in the popup.
- **Like suggestion**: after watching a bit, a discreet one-click "👍 Like" button to support RachtaZ — on **all** of his videos (streams *and* normal uploads), shown only if you haven't already liked. **Never automatic** (you click it). Toggle in the popup.
- **Popup**: status + clickable game list + **Rescan** button + **Resume** & **Like** toggles

---

## 📦 Installation (developer mode)

1. Clone or unzip this folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **"Load unpacked"**
5. Select the `rachtaz-stream-enhancer` folder

✅ The extension is now installed!

> 💡 After updating the files, click the **↻ Reload** button on the extension in `chrome://extensions/`.

---

## 🚀 Usage

1. Open a @RachtaZ VOD on YouTube
2. The extension automatically scans the comments (~a few seconds the first time)
3. **Red markers** appear on the timeline and the buttons are injected into the player
4. To navigate:
   - open the **game list** (☰ button in the player or the `L` key) and click the game you want
   - or use **`N` / `P`** to move forward / back game by game
   - or the player's **`◀ Previous`** / **`⏭ Next`** buttons

   The red markers on the timeline visually show where each game starts.

---

## 🔧 Expected comment format

```
00:15:26 Game 1
00:51:41 Game 2
01:01:05 Game 3
...
```

Both `MM:SS` and `HH:MM:SS` formats are supported. Lines are sorted chronologically automatically.

---

## ⌨️ Shortcuts

| Key  | Action |
|:----:|--------|
| `N`  | Next game |
| `P`  | Previous game (restarts the current game if you're deep into it) |
| `L`  | Show / hide the game list |

> On stream VODs, `L` opens the game list instead of YouTube's default "+10 s". The shortcuts are only active on RachtaZ streams and never while typing in a field.

---

## 🌐 Browser compatibility

Works on **Chrome**, **Edge**, **Opera** and **Firefox** (Manifest V3, shared `chrome.*` APIs).

| Browser | Store | Note |
|---|---|---|
| Chrome | Chrome Web Store | None |
| Edge   | Microsoft Edge Add-ons | Accepts the Chromium package as-is |
| Opera  | Opera add-ons (or install from the Chrome Web Store) | Same Chromium package as Chrome/Edge |
| Firefox | addons.mozilla.org (AMO) | Needs the `browser_specific_settings.gecko` key (added automatically by the build) |

---

## 📦 Build & publishing

```bash
python build.py
```

Generates two upload-ready zips in `dist/`:

- `…-chrome-edge-v<version>.zip` → Chrome Web Store, Edge Add-ons **and** Opera add-ons (same Chromium package)
- `…-firefox-v<version>.zip` → Firefox AMO (manifest enriched with the gecko ID)

See [PUBLICATION.md](PUBLICATION.md) for the full store-listing sheet and [PRIVACY.md](PRIVACY.md) for the privacy policy.

---

## ⚠️ Notes

- The extension works **only on @RachtaZ videos**
- **Streams vs normal videos**: the timecode scan and navigation features (chapters, list, Prev/Next, resume) only run on **stream VODs** (over ~1h, `STREAM_MIN_S`). On normal RachtaZ uploads, nothing is scanned — only the optional Like suggestion appears.
- **Shorts**: never touched. They live at `youtube.com/shorts/…` and the extension only runs on `…/watch`; the Like suggestion is also skipped for any clip ≤ 3 min (`SHORT_MAX_S`).
- The **first** scan of a video can take a few seconds (YouTube lazy-loads comments, so the extension scrolls automatically then **restores your position**). Subsequent visits are instant thanks to the cache.
- If the timecodes aren't found or the comment was edited, use the popup's **🔄 Rescan** button to force a new scan.

---

## 📁 File structure

```
rachtaz-stream-enhancer/
├── manifest.json   — Extension configuration (Manifest V3)
├── content.js      — Main script injected into YouTube
├── styles.css      — Styles for the buttons, panel and markers
├── popup.html      — Popup UI
├── popup.js        — Popup logic
├── build.py        — Builds the Chromium (Chrome/Edge/Opera) and Firefox packages
├── promo.py        — Generates the Chrome Web Store promo tiles
├── PUBLICATION.md  — Store-listing sheet
├── PRIVACY.md      — Privacy policy
├── CHANGELOG.md    — Version history
├── LICENSE         — MIT license
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```
