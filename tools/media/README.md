# Demo media

The README video is a 100-second edit of the current `app/static/demo/` film, with its original animation and a locally synthesized instrumental score. It uses synthetic laboratory data. The alternate film is preserved in `app/static/demo-v2/`.

The current film supports two presentation URLs:

- `/demo/?capture=1`: clean full-frame presentation, 100-second timing, and a **Start recording** button. The normal interactive film is unchanged.
- `/demo/?still=1#doctor/3`: clean, settled screenshot of a named chapter/build. The other chapter names are `mindline`, `capture`, `users`, `hygiene`, `ask`, `graph`, and `close`.

Capture the visible frames with the supported browser screenshot tool and save the recording timestamps to `build/capture.json`. `encode.py` converts those frames into H.264/AAC MP4 with FFmpeg. Temporary frames and builds are ignored by Git; final video and selected screenshots live in `docs/media/`.

Music is an original synthesized composition made for Mindline: soft keys, pads, bass and light percussion, with no third-party recordings or vocals. Its 106-second master is `app/static/demo-v2/assets/mindline-v2-instrumental.mp3`; the current cut adjusts its tempo to fit 100 seconds and fades out. `score.py` retains the original synthesis source. Python with NumPy is needed only to regenerate the score; FFmpeg is needed to encode media.

`upload_readme_video.py` uploads the MP4 as an attachment scoped to the existing private Mindline repository, using GitHub's media-upload endpoint used by the official GitHub CLI. It obtains credentials from the existing `gh` login in memory and never writes or prints them. The returned URL can appear alone in a README paragraph as GitHub's inline video player.
