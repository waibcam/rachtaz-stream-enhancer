# Changelog

All notable changes to **RachtaZ Stream Enhancer**.

## 1.0.1
- `homepage_url` now points to the download hub page:
  https://waibcam.github.io/rachtaz-stream-enhancer/

## 1.0.0 — First public release

First version published to the Chrome Web Store, Edge Add-ons, Opera add-ons and
Firefox AMO. Highlights:

- **Timeline chapters**: a marker per game on the progress bar (stream VODs).
- **Gold seek bar** tinted in RachtaZ's gold, scoped to his videos only.
- **Game list panel** (`L`): clickable, current game highlighted, with per-game
  **shareable timestamped links** (copy button).
- **Player buttons** `◀ Previous` / `⏭ Next — [Game]` and shortcuts **N / P / L**.
- **Resume playback**: a one-click toast to jump back to where you left off —
  precise, and it never overrides shared `t=` links.
- **Like suggestion**: a discreet one-click toast on all RachtaZ videos
  (except Shorts) — always manual, never automatic.
- **Per-video cache**, **self-healing UI**, and a robust comment scan that only
  runs on stream VODs (> 1 h).
- Requests a single permission (`storage`) plus access to `youtube.com`.
- Multi-browser build (`build.py`) for Chrome/Edge/Opera and Firefox.
