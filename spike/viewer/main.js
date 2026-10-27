// Phase 0 viewer spike: load one splat, report size, load time, splat count and fps.
// Usage: index.html?sample=painted | greyscale | street | butterfly, or ?url=<splat url>.
// Add &cold=1 to bypass the browser cache, &auto=1 to run the turn test on load
// and POST the numbers to /results (see serve.py).
// Results are mirrored on window.spike so they can be read from the console.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

const SAMPLES = {
  painted: "https://storage.googleapis.com/forge-dev-public/painted_bedroom.spz",
  greyscale: "https://storage.googleapis.com/forge-dev-public/marble-scenes/greyscale-room.spz",
  street: "https://sparkjs.dev/assets/splats/snow-street.spz",
  butterfly: "https://sparkjs.dev/assets/splats/butterfly.spz",
};

const params = new URLSearchParams(location.search);
const sampleName = params.get("sample") ?? "painted";
const baseUrl = params.get("url") ?? SAMPLES[sampleName];
const cold = params.has("cold");
const auto = params.has("auto");
// &shot=<name> saves a frame grab to media/samples/<name>.png two seconds after load.
const shot = params.get("shot");
// A unique query string makes the browser treat the file as new, so the load is cold.
const url = cold ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}cb=${Date.now()}` : baseUrl;
const readout = document.getElementById("readout");
const turnButton = document.getElementById("turn");

const spike = (window.spike = {
  url: baseUrl,
  cold,
  viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
  userAgent: navigator.userAgent,
  bytes: null,
  loadMs: null,
  numSplats: null,
  fps: null,
  turnTest: null,
  error: null,
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 1000);
// Keeping the drawing buffer costs a little speed, so only frame grabs ask for it.
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: Boolean(shot) });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
scene.add(new SparkRenderer({ renderer }));

// Marble worlds spawn the viewer at the origin. Orbiting a target just ahead of
// the camera turns orbit controls into look-around controls.
camera.position.set(0, 0, 0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, -0.1);
controls.update();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function render() {
  const lines = [
    `file      ${url.split("/").pop()}`,
    `size      ${spike.bytes ? (spike.bytes / 1e6).toFixed(1) + " MB" : "?"}`,
    `load      ${spike.loadMs ? (spike.loadMs / 1000).toFixed(2) + " s" : "loading..."}`,
    `splats    ${spike.numSplats ? spike.numSplats.toLocaleString() : "?"}`,
    `fps       ${spike.fps ?? "?"}`,
  ];
  if (spike.turnTest) {
    const t = spike.turnTest;
    lines.push(t.done ? `turn test avg ${t.avgFps} fps, min ${t.minFps} fps` : "turn test running...");
  }
  if (spike.error) lines.push(`error     ${spike.error}`);
  readout.textContent = lines.join("\n");
}

// Content-Length is a CORS-safelisted header, so a HEAD request gives the file size.
fetch(url, { method: "HEAD" })
  .then((res) => { spike.bytes = Number(res.headers.get("content-length")) || null; render(); })
  .catch(() => {});

const started = performance.now();
const splat = new SplatMesh({ url });
// Marble uses OpenCV axes (y down, z forward). A half turn about x converts to three.js axes.
splat.quaternion.set(1, 0, 0, 0);
scene.add(splat);
splat.initialized
  .then(() => {
    spike.loadMs = Math.round(performance.now() - started);
    spike.numSplats = splat.numSplats;
    turnButton.disabled = false;
    render();
    // Give the first frames a second to settle before measuring.
    if (auto) setTimeout(() => turnButton.click(), 1000);
    if (shot) {
      setTimeout(() => {
        renderer.domElement.toBlob((blob) =>
          fetch(`/shot?name=${encodeURIComponent(shot)}`, { method: "POST", body: blob }).catch(() => {}),
        );
      }, 2000);
    }
  })
  .catch((err) => { spike.error = String(err); render(); report(); });

function report() {
  if (!auto) return;
  fetch("/results", { method: "POST", body: JSON.stringify(spike) }).catch(() => {});
}

// Rolling fps over the last second of frames, plus per-frame samples during the turn test.
let frames = [];
let turn = null;
turnButton.addEventListener("click", () => {
  turn = { start: performance.now(), samples: [] };
  spike.turnTest = { done: false };
  turnButton.disabled = true;
});

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = now - last;
  last = now;
  frames.push(now);
  while (frames.length && now - frames[0] > 1000) frames.shift();
  spike.fps = frames.length;

  if (turn) {
    const elapsed = now - turn.start;
    if (elapsed < 10000) {
      // One full turn in 10 seconds, rotating the look target around the camera.
      const angle = (elapsed / 10000) * Math.PI * 2;
      controls.target.set(Math.sin(angle) * -0.1, 0, Math.cos(angle) * -0.1);
      if (dt > 0) turn.samples.push(1000 / dt);
    } else {
      const s = turn.samples;
      spike.turnTest = {
        done: true,
        avgFps: Math.round(s.length / 10),
        minFps: Math.round(Math.min(...s)),
        frames: s.length,
      };
      turn = null;
      turnButton.disabled = false;
      report();
    }
  }

  controls.update();
  renderer.render(scene, camera);
  render();
});
