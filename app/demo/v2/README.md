# Version 2 demo

Open `http://localhost:8800/demo-v2/` with the Mindline server running, or open `app/static/demo-v2/index.html` directly. All runtime assets are local. V1 remains at `/demo/` and has not been edited.

- Runtime: **106 seconds / 1:46**, no voiceover.
- Story and shot list: `app/static/demo-v2/SCRIPT.md`.
- Read-only snapshots: `app/static/demo-v2/data.js`. Doctor/ward inputs come from the original demo. Prediction inputs were read from the existing server at an explicit `asof=2026-09-27`; its clock was not changed.
- `original-demo-sha256.json` records V1 hashes taken before V2 work.
- Chapter buttons, left/right arrows, play/pause, time scrubber, music, fullscreen, evidence selection, and a source panel are supported. Playback pauses when a user explores a view or the tab is hidden.
- On reduced motion, drawings appear settled and playback starts paused.
- Capture mode: `/demo-v2/?clean=1&autoplay=1`. Autoplay is silent until a user gesture permits audio. The soundtrack can be muxed separately from `assets/mindline-v2-instrumental.mp3`.
- Capture API: `window.mindlineV2.seek(seconds, {pause: true, settle: false})` sets an exact animation frame. Omit `settle: false` for settled stills. `play()`, `pause()`, `state()`, `duration`, and scene start times are exposed too.

The note/Ask/generator interactions are local presentation controls. They do not mutate the running app or call a model. The illustrated late-arrival bars and generation branches are labelled schematic. The prediction chart and doctor/ward counts come from prototype outputs.

The generated music reuses the project's original synthesis composition, extended to 53 bars with an ending at 106 seconds. `make_music.py` builds it without altering the original score or video.
