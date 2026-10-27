# Phase 0 results

**Decision (provisional, 2026-10-27):** the viewer path works. A 500k-splat Marble room loads in about 2 seconds and holds 60 fps in Chrome on the reference machine, well inside the targets (10 seconds or less, 30 fps or more). Default tier for now: 500k SPZ. This is measured on Marble sample rooms, not on the café; task 3 (paid) and the Safari run are still open.

## Reference machine

- Mac Studio (Mac14,13), Apple M2 Max, 38-core GPU, 64 GB, macOS 26.6.2
- Display: 5K at 60 Hz, so 60 fps is the ceiling of what the page can report
- Browser window: 1440 x 898 CSS pixels at device pixel ratio 2 (the page caps the ratio at 2)
- Chrome 156.0.8078.48. Safari 26.6.2, not measured (see below)
- Network: Wi-Fi, home connection. Files come from public storage over the internet, so load time includes download

## Task 2: viewer spike with sample splats

Samples are real Marble rooms from Spark's example asset list, loaded by URL. Sources and license notes are in [spike/viewer/README.md](../../spike/viewer/README.md). Each run was a cold load (cache-busting query), followed by a 10 second camera turn. Raw records are in `media/spike-results-chrome.jsonl`, ignored by git.

| Sample | Splats | File size | Browser | Load, 3 cold runs (ms) | Median load | Turn test avg / min fps |
|---|---|---|---|---|---|---|
| painted bedroom | 500,000 | 7.8 MB | Chrome | 2041, 2157, 1927 | 2.0 s | 60 / 56, 60 / 50 |
| greyscale room | 2,000,000 | 30.7 MB | Chrome | 4699, 5400, 4942 | 4.9 s | 60 / 56 |
| painted bedroom | 500,000 | 7.8 MB | Safari | not run | | |
| greyscale room | 2,000,000 | 30.7 MB | Safari | not run | | |

Notes on the numbers:

- File sizes come from `curl`. The page's own size readout fails on this storage host, which does not answer cross-origin HEAD requests. It works for local files served from `media/`.
- Load time runs from creating the `SplatMesh` to its `initialized` promise, so it covers download, parsing and GPU upload.
- Three of the six turn tests were cut short because the browser window was covered while they ran, and a covered window stops rendering. Their fps values are dropped above. Their load times are kept, since loading does not depend on rendering.
- The fps numbers sit at the display's 60 Hz cap, so they show the target is met, not how much headroom there is.
- One `curl` download of the same files took 3.2 s and 5.9 s, so network speed varies by run more than the browser does.

## What the rooms look like

Frame grabs from Chrome at the spawn point are in `media/samples/` (ignored): `chrome-painted.png`, `chrome-greyscale.png`.

- Both rooms read clearly as rooms from the spawn point: bed, window, furniture, rugs, a doorway.
- Objects close to the camera at the frame edges are soft and smeared. Moving around near the spawn point is fine. Walking far from it is untested.
- The greyscale room has a framed picture with a caption of invented letters. This confirms the spec decision: scenery text is never used for teaching, and signs the learner should read are drawn as overlays from the scenario file.

## Not covered yet

- **Safari.** Safari was running but did not answer requests to open a page (macOS error -1712, a timeout). It may have a dialog open or be stuck. It was left alone. To run it: open `http://localhost:5173/?sample=painted&cold=1&auto=1` in Safari with `spike/viewer/serve.py` running, keep the window in front for 20 seconds, repeat for `greyscale`, three times each.
- **The café itself (task 3).** Needs a paid Marble plan or API credits, waiting for approval.
- **A slower machine, a phone, a slow network.** All numbers above are from one fast desktop.
- **WebXR on Quest 3.** Spark ships a WebXR example (`examples/webxr` in its repo), so it is worth trying in the optional Quest phase. Not tested.
