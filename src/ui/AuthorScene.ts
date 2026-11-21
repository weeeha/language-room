// The Scene section of the authoring form. The app never calls a scene generation service:
// the teacher makes the scene elsewhere, then attaches the exported file here to place things.
// The file is read in this page from an object URL. It is never uploaded or stored.
import {
  attachScene,
  clearNameTag,
  FILE_NOTE,
  getPosition,
  isUnplaced,
  MARBLE_STEPS,
  marblePrompt,
  placeableTargets,
  removeScene,
  SCENE_COST_TEXT,
  setCoordinate,
  setPosition,
  setSpawn,
  setSpawnCoordinate,
  SIGNAGE_REVIEW_NOTE,
  type AuthorTarget,
} from "../author/placement";
import type { Vec3 } from "../scenario/validate";
import { createHotspots } from "../scene/hotspots";
import { SAMPLE_SCENE_URL } from "../scene/mount";
import { createNameTag } from "../scene/nametag";
import type { OverlayGroup } from "../scene/overlay";
import { bindPick } from "../scene/place";
import { createSignage } from "../scene/signage";
import { createSceneViewer, type SceneViewer } from "../scene/viewer";
import type { AuthorCtx } from "./Author";
import { h, notice, signageNotice } from "./dom";

const AXES = ["X", "Y", "Z"] as const;

interface Session {
  url: string;
  name: string;
  /** Set for a file chosen in this page, so the object URL can be released. */
  objectUrl?: string;
  sample?: boolean;
}

export function createSceneSection(ctx: AuthorCtx): { element: HTMLElement; dispose(): void } {
  const idText = (): string => ctx.getState().id.trim() || "<scenario id>";

  // ----- generate -----
  const stepList = h("ol", {});
  const promptBox = h("textarea", { rows: "4", readonly: true, id: "marble-prompt" });
  const copyBtn = h("button", { class: "btn", type: "button" }, "Copy prompt");
  const copyStatus = h("p", { class: "status", role: "status" });
  copyBtn.addEventListener("click", () => {
    const text = promptBox.value;
    if (!text) {
      copyStatus.textContent = "Write a place name or prompt above first.";
      return;
    }
    const done = (ok: boolean): void => {
      copyStatus.textContent = ok ? "Prompt copied." : "Press Ctrl+C or Cmd+C to copy the selected text.";
      if (!ok) {
        promptBox.focus();
        promptBox.select();
      }
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
    else done(false);
  });

  // ----- attach -----
  const fileInput = h("input", { type: "file", accept: ".spz,.ply" });
  const attachStatus = h("p", { class: "status", role: "status" });
  const attachError = h("p", { class: "field-error", role: "alert" });
  attachError.hidden = true;
  const removeBtn = h("button", { class: "btn", type: "button" }, "Remove the scene");
  const sampleBtn = import.meta.env.DEV ? h("button", { class: "btn", type: "button" }, "Use the sample room") : null;
  const fileNote = h("p", { class: "muted" });
  const sceneField = ctx.field("scene", "Scene file (.spz or .ply)", fileInput);

  // ----- viewer -----
  let session: Session | undefined;
  let viewer: SceneViewer | undefined;
  let offFrame: (() => void) | undefined;
  let unbindPick: (() => void) | undefined;
  let groups: OverlayGroup[] = [];
  let ready = false;
  let mountToken = 0;

  const host = h("div", { class: "scene-canvas-host" });
  const extras = h("div", { class: "scene-extras" });
  const loadMsg = h("p", { class: "overlay author-msg", role: "status" });
  const surface = h("div", { class: "author-surface", id: "author-surface" }, host, extras, loadMsg);
  const sampleLabel = h("p", { class: "muted", role: "status" });
  sampleLabel.hidden = true;

  function disposeViewer(): void {
    mountToken += 1;
    unbindPick?.();
    unbindPick = undefined;
    offFrame?.();
    offFrame = undefined;
    viewer?.dispose();
    viewer = undefined;
    ready = false;
    surface.classList.remove("is-placed");
    rebuildOverlays();
  }

  function mountViewer(): void {
    disposeViewer();
    const scene = ctx.getState().scene;
    if (!session || !scene) {
      loadMsg.textContent = scene ? "Choose the scene file again to see it here. The app does not keep the file." : "";
      loadMsg.hidden = !scene;
      return;
    }
    loadMsg.textContent = "Loading the scene.";
    loadMsg.hidden = false;
    const token = ++mountToken;
    const v = createSceneViewer(host, {
      scene,
      url: session.objectUrl ? `${session.url}#${session.name}` : session.url,
      onProgress(f) {
        if (f !== null) loadMsg.textContent = `Loading the scene, ${Math.round(f * 100)} percent`;
      },
      onState(state, err) {
        if (token !== mountToken || !viewer) return;
        if (state === "ready") {
          const live = viewer;
          ready = true;
          loadMsg.hidden = true;
          surface.classList.add("is-placed");
          offFrame = live.onFrame(() => groups.forEach((g) => g.update(live)));
          rebuildOverlays();
        } else if (state === "failed") {
          loadMsg.hidden = false;
          loadMsg.textContent = `The scene could not be loaded${err ? `: ${err.message}` : ""}. Check that the file is an SPZ or PLY export, then choose it again.`;
        }
      },
    });
    viewer = v;
    unbindPick = bindPick(
      surface,
      v,
      (pos) => {
        const t = current();
        if (t) ctx.setState((s) => setPosition(s, t.target, pos));
      },
      ".placed, .author-msg",
    );
  }

  function rebuildOverlays(): void {
    for (const g of groups) g.dispose?.();
    for (const el of groups.flatMap((g) => g.elements)) el.remove();
    const s = ctx.getState();
    const code = s.languageCode.trim() || "und";
    const spots = s.hotspots.filter((x) => x.id && x.word.trim());
    const signs = s.signage.filter((x) => x.id && x.text.trim());
    const nameTag = createNameTag({ text: s.characterName.trim() || "Character", lang: code }, () => ctx.getState().anchor);
    const hot = createHotspots(spots, code);
    const sig = createSignage(signs, code);
    groups = [nameTag, hot, sig];
    surface.append(...nameTag.elements);
    extras.replaceChildren(...hot.elements, ...sig.elements);
    const v = viewer;
    if (ready && v) groups.forEach((g) => g.update(v));
  }

  // ----- placing -----
  const targetSelect = h("select", { id: "place-item" });
  const posInputs = AXES.map((axis, i) => {
    const input = h("input", { type: "number", step: "0.05", id: `pos-${axis.toLowerCase()}`, inputmode: "decimal" });
    input.addEventListener("change", () => {
      const t = current();
      if (t) ctx.setState((s) => setCoordinate(s, t.target, i as 0 | 1 | 2, input.valueAsNumber));
    });
    return input;
  });
  const posNote = h("p", { class: "muted", role: "status" });
  const clearTagBtn = h("button", { class: "btn btn-small", type: "button" }, "Clear the name tag position");
  clearTagBtn.addEventListener("click", () => ctx.setState((s) => clearNameTag(s)));

  const spawnBtn = h("button", { class: "btn", type: "button" }, "Use the current view as the starting view");
  const spawnStatus = h("p", { class: "status", role: "status" });
  spawnBtn.addEventListener("click", () => {
    const pose = viewer?.pose();
    if (!pose) {
      spawnStatus.textContent = "The scene is not ready. Choose the scene file and wait for it to load.";
      return;
    }
    ctx.setState((s) => setSpawn(s, pose.position, pose.lookAt));
    spawnStatus.textContent = "Starting view set from the scene.";
  });
  const spawnInputs = (["position", "lookAt"] as const).map((which) =>
    AXES.map((axis, i) => {
      const input = h("input", { type: "number", step: "0.05", id: `spawn-${which}-${axis.toLowerCase()}`, inputmode: "decimal" });
      input.addEventListener("change", () => ctx.setState((s) => setSpawnCoordinate(s, which, i as 0 | 1 | 2, input.valueAsNumber)));
      return input;
    }),
  );

  function numberGroup(legend: string, inputs: HTMLInputElement[], note?: HTMLElement): HTMLElement {
    return h(
      "fieldset",
      { class: "numbers" },
      h("legend", {}, legend),
      h("div", { class: "number-row" }, ...inputs.map((input, i) => h("div", { class: "field" }, h("label", { for: input.id }, AXES[i] ?? ""), input))),
      note ?? null,
    );
  }

  const placeBlock = h(
    "div",
    {},
    h("p", { class: "muted" }, "Pick an item, then click in the scene to set where it goes. Drag to look around. You can also type the numbers, which is the way to do it without a mouse."),
    h("div", { class: "field" }, h("label", { for: "place-item" }, "Item to place"), targetSelect),
    numberGroup("Position of the chosen item", posInputs, posNote),
    clearTagBtn,
    h("h4", {}, "Starting view"),
    h("p", { class: "muted" }, "Look around in the scene, then use the button. It saves where you stand and what you look at."),
    h("div", { class: "actions" }, spawnBtn),
    spawnStatus,
    numberGroup("Starting position", spawnInputs[0] ?? []),
    numberGroup("Looking at", spawnInputs[1] ?? []),
  );
  const noSceneText = h("p", { class: "muted" }, "Attach a scene file to place words and signs. Without a scene, words and signs show as plain labels.");
  const sceneBlock = h("div", {}, surface, sampleLabel, placeBlock);

  function current(): { target: AuthorTarget } | undefined {
    const list = placeableTargets(ctx.getState());
    return list[Number(targetSelect.value)];
  }

  let lastLabels = "";
  function syncControls(): void {
    const s = ctx.getState();
    const list = placeableTargets(s);
    const labels = JSON.stringify(list.map((t) => t.label));
    if (labels !== lastLabels) {
      const keep = Math.min(Number(targetSelect.value) || 0, list.length - 1);
      targetSelect.replaceChildren(...list.map((t, i) => h("option", { value: String(i) }, t.label)));
      targetSelect.value = String(Math.max(0, keep));
      lastLabels = labels;
    }
    const t = current();
    const pos = t ? getPosition(s, t.target) : undefined;
    posInputs.forEach((input, i) => {
      if (document.activeElement !== input) input.value = pos ? String(pos[i]) : "";
    });
    posNote.textContent = !t ? "" : isUnplaced(s, t.target) ? "Not placed yet." : "";
    clearTagBtn.hidden = !(t?.target.kind === "nametag" && s.anchor);
    const spawn = s.scene?.spawn;
    (["position", "lookAt"] as const).forEach((which, w) => {
      (spawnInputs[w] ?? []).forEach((input, i) => {
        if (document.activeElement !== input) input.value = spawn ? String((spawn[which] as Vec3)[i]) : "";
      });
    });
  }

  function sync(): void {
    const s = ctx.getState();
    stepList.replaceChildren(...MARBLE_STEPS.map((t) => h("li", {}, t.replace("<scenario id>", idText()))));
    promptBox.value = marblePrompt(s);
    fileNote.textContent = FILE_NOTE.replace("<scenario id>", idText());
    const attached = Boolean(s.scene);
    removeBtn.hidden = !attached;
    attachStatus.textContent = s.scene ? `The scenario points to ${s.scene.file}.` : "No scene file is attached.";
    sceneBlock.hidden = !attached;
    noSceneText.hidden = attached;
    if (!attached && session) {
      if (session.objectUrl) URL.revokeObjectURL(session.objectUrl);
      session = undefined;
      disposeViewer();
    }
    sampleLabel.hidden = !session?.sample;
    if (session?.sample) sampleLabel.textContent = `Sample room, not your scene. The scenario now points to ${s.scene?.file ?? ""}, which does not exist on this computer.`;
    syncControls();
    rebuildOverlays();
  }

  function useSession(next: Session): void {
    if (session?.objectUrl) URL.revokeObjectURL(session.objectUrl);
    session = next;
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    attachError.hidden = true;
    const result = attachScene(ctx.getState(), file.name);
    if (!result.ok) {
      attachError.textContent = result.reason;
      attachError.hidden = false;
      fileInput.value = "";
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    useSession({ url: objectUrl, objectUrl, name: result.state.scene?.file.split("/").pop() ?? file.name });
    ctx.setState(() => result.state);
    mountViewer();
    ctx.announce(`Scene file attached. The scenario points to ${result.state.scene?.file ?? ""}.`);
  });
  sampleBtn?.addEventListener("click", () => {
    const result = attachScene(ctx.getState(), "painted_bedroom.spz");
    if (!result.ok) {
      attachError.textContent = result.reason;
      attachError.hidden = false;
      return;
    }
    attachError.hidden = true;
    useSession({ url: SAMPLE_SCENE_URL, name: "painted_bedroom.spz", sample: true });
    ctx.setState(() => result.state);
    mountViewer();
  });
  removeBtn.addEventListener("click", () => {
    ctx.setState((s) => removeScene(s));
    ctx.announce("Scene removed.");
  });
  targetSelect.addEventListener("change", syncControls);
  ctx.onChange(sync);

  const element = h(
    "section",
    { "aria-labelledby": "h-scene" },
    h("h2", { id: "h-scene" }, "Scene"),
    h("p", { class: "muted" }, "A scene is optional. The conversation works without one."),
    h("h3", {}, "Make the scene in Marble"),
    notice(SCENE_COST_TEXT),
    stepList,
    h("div", { class: "field" }, h("label", { for: "marble-prompt" }, "Prompt for Marble"), promptBox),
    h("div", { class: "actions" }, copyBtn),
    copyStatus,
    h("h3", {}, "Attach the scene file"),
    sceneField,
    attachError,
    h("div", { class: "actions" }, ...(sampleBtn ? [sampleBtn] : []), removeBtn),
    attachStatus,
    fileNote,
    signageNotice(),
    h("p", { class: "muted" }, SIGNAGE_REVIEW_NOTE),
    h("h3", {}, "Place words and signs"),
    noSceneText,
    sceneBlock,
  );
  sync();
  if (ctx.getState().scene) mountViewer();

  return {
    element,
    dispose() {
      disposeViewer();
      if (session?.objectUrl) URL.revokeObjectURL(session.objectUrl);
    },
  };
}
