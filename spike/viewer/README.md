# Viewer spike (phase 0, tasks 2 and 4)

A throwaway page that loads one Gaussian splat with three.js and Spark and reports file size, load time, splat count and frames per second. It exists to measure, before any app code depends on the numbers. Results go to [docs/spikes/phase-0-results.md](../../docs/spikes/phase-0-results.md).

## Run it

```bash
python3 spike/viewer/serve.py
```

Then open one of these in Chrome or Safari:

- `http://localhost:5173/?sample=painted`: a Marble room, 500k splats, about 7.8 MB.
- `http://localhost:5173/?sample=greyscale`: a Marble room, about 30.7 MB.
- `http://localhost:5173/?url=/media/lisbon-cafe/cafe-500k.spz`: a local export. `serve.py` serves the ignored `media/` folder at `/media/`.

Flags: `&cold=1` adds a cache-busting query so the load is cold. `&auto=1` runs the 10 second turn test after load and POSTs the numbers to `/results`, which `serve.py` appends to `media/spike-results.jsonl` (ignored).

Drag to look around. The button runs the turn test by hand: one full turn of the camera in 10 seconds, reporting average and minimum fps.

## Pinned versions

- three.js 0.180.0 (jsDelivr)
- Spark 2.4.0 (`sparkjs.dev/releases/spark/2.4.0/spark.module.js`), the version in Spark's quick start, read 2026-10-27

## Sample sources

The samples are loaded by URL from the hosts below and never copied into this repo or `media/`.

| Sample | URL | Source |
|---|---|---|
| painted | `https://storage.googleapis.com/forge-dev-public/painted_bedroom.spz` | Spark examples asset list (`examples/assets.json` in `sparkjsdev/spark`) |
| greyscale | `https://storage.googleapis.com/forge-dev-public/marble-scenes/greyscale-room.spz` | same list, under `marble-scenes/` |
| street | `https://sparkjs.dev/assets/splats/snow-street.spz` | same list |
| butterfly | `https://sparkjs.dev/assets/splats/butterfly.spz` | Spark quick start |

**License:** Spark's code is MIT. Neither the Spark README nor its docs state a license for these sample assets (checked 2026-10-27). They are used here only for local performance testing, loaded from their public URLs and not redistributed. Do not ship them in the app or commit them.

## Notes

- Marble worlds use OpenCV axes (y down, z forward). The page applies a half turn about x, as Spark's own viewer example does.
- The camera starts at the origin, where Marble places the viewer, and orbits a target 10 cm ahead, which works as look-around.
- Load time is measured from creating the `SplatMesh` to its `initialized` promise resolving, so it includes download, parsing and upload to the GPU.
- A hidden browser tab pauses rendering, so fps reads 0 there. Measure in a visible window.
