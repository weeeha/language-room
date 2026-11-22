import { describe, expect, it, vi } from "vitest";
import { createConversation } from "../conversation/loop";
import { createMemoryStore } from "../conversation/session";
import type { LlmProvider } from "../providers/llm";
import type { TtsProvider } from "../providers/tts";
import type { Scenario } from "../scenario/validate";
import { buildConfirmedTurn } from "../ui/HeardConfirm";
import {
  createSceneController,
  decideSceneAction,
  pickSceneFile,
  readConnection,
  SCENE_FAILED_NOTICE,
  shouldRender,
  startConversationThenScene,
  type MountArgs,
  type SceneHandle,
} from "./fallback";
import { resolveSceneUrl, SceneLoadError, type SceneLoadReason } from "./loader";

const scenario = {
  id: "cafe",
  version: 1,
  title: "Cafe",
  language: { code: "pt-PT", name: "European Portuguese" },
  level: "A2",
  place: {
    name: "Pastelaria",
    scene: {
      file: "media/cafe/scene-500k.spz",
      format: "spz",
      spawn: { position: [0, 1.6, 2], lookAt: [0, 1.4, -1] },
      tiers: { low: "media/cafe/scene-100k.spz" },
    },
  },
  character: { name: "Dona Amélia", role: "owner", persona: "Friendly" },
  goal: { description: "Order", steps: [{ id: "greet", hint: "Say good morning." }] },
  targets: { phrases: [], grammar: [] },
} as unknown as Scenario;

const noScene = { ...scenario, place: { name: "Pastelaria" } } as unknown as Scenario;

const llm: LlmProvider = {
  kind: "llm",
  id: "llm",
  label: "Reply",
  paid: false,
  async complete() {
    return { text: '{"done":[]}' };
  },
  async completeStream(_req, onDelta) {
    onDelta("Bom dia. Diga, faz favor.");
    return { text: "Bom dia. Diga, faz favor." };
  },
};
const checker: LlmProvider = { ...llm, id: "chk", async complete() { return { text: '{"issues":[]}' }; } };
const tts: TtsProvider = { kind: "tts", id: "tts", label: "Tts", paid: false, async speak() {} };

function conversation() {
  return createConversation(
    {
      llm,
      analyzer: checker,
      reviewer: { ...checker, async complete() { return { text: '{"verdict":"correct","reason":"r"}' }; } },
      tts,
      store: createMemoryStore(),
      providerIds: { stt: "stt", llm: "llm", analyzer: "chk", reviewer: "chk", tts: "tts" },
    },
    scenario,
    { lang: "pt-PT" },
  );
}

function handle(ready: Promise<void>): SceneHandle & { calls: string[] } {
  const calls: string[] = [];
  return { ready, calls, pause: () => void calls.push("pause"), resume: () => void calls.push("resume"), dispose: () => void calls.push("dispose") };
}

function controllerWith(
  mount: (a: MountArgs) => SceneHandle,
  over: { scenario?: Scenario; env?: { webgl: boolean; saveData?: boolean; effectiveType?: string } } = {},
) {
  return createSceneController({
    scenario: over.scenario ?? scenario,
    env: over.env ?? { webgl: true },
    resolveUrl: resolveSceneUrl,
    mount,
  });
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("a scene that fails never stops the conversation", () => {
  for (const reason of ["not-found", "timeout", "webgl"] as SceneLoadReason[]) {
    it(`ends in failed with the exact notice when the loader rejects: ${reason}`, async () => {
      const mount = vi.fn(() => handle(Promise.reject(new SceneLoadError(reason, reason))));
      const controller = controllerWith(mount);
      const conv = conversation();
      let started: Promise<void> = Promise.resolve();
      startConversationThenScene(
        () => void (started = conv.start()),
        () => controller.start(),
      );
      await started;
      await settle();

      expect(controller.model.status).toBe("failed");
      expect(controller.model.reason).toBe(reason);
      expect(controller.model.notice).toBe("Scene unavailable, continuing without it");
      expect(SCENE_FAILED_NOTICE).toBe("Scene unavailable, continuing without it");
      // The conversation started and still takes a learner turn.
      expect(conv.session.turns.map((t) => t.role)).toEqual(["character"]);
      const turn = buildConfirmedTurn({ text: "Bom dia." }, null);
      if (!turn) throw new Error("empty turn");
      await conv.send(turn);
      expect(conv.session.turns.map((t) => t.role)).toEqual(["character", "learner", "character"]);
    });
  }

  it("ends in failed when the viewer reports failure through onState", async () => {
    let args!: MountArgs;
    const controller = controllerWith((a) => {
      args = a;
      return handle(new Promise(() => undefined));
    });
    controller.start();
    expect(controller.model.status).toBe("loading");
    args.onState("failed", new SceneLoadError("network", "x"));
    expect(controller.model).toMatchObject({ status: "failed", reason: "network", notice: SCENE_FAILED_NOTICE });
  });

  it("ends in failed when mounting the viewer throws", () => {
    const controller = controllerWith(() => {
      throw new Error("boom");
    });
    controller.start();
    expect(controller.model).toMatchObject({ status: "failed", reason: "unknown", notice: SCENE_FAILED_NOTICE });
  });

  it("starts the conversation before the scene, and a throwing scene start does not stop it", () => {
    const order: string[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    startConversationThenScene(
      () => order.push("conversation"),
      () => {
        order.push("scene");
        throw new Error("scene broke");
      },
    );
    warn.mockRestore();
    expect(order).toEqual(["conversation", "scene"]);
  });

  it("fails with webgl and loads nothing when the browser has no WebGL", () => {
    const mount = vi.fn();
    const controller = controllerWith(mount, { env: { webgl: false } });
    controller.start();
    expect(mount).not.toHaveBeenCalled();
    expect(controller.model).toMatchObject({ status: "failed", reason: "webgl", notice: SCENE_FAILED_NOTICE });
  });
});

describe("no scene in the scenario", () => {
  it("decides skip and makes no loader call", () => {
    expect(decideSceneAction({ hasScene: false, webgl: true })).toBe("skip");
    const mount = vi.fn();
    const controller = controllerWith(mount, { scenario: noScene });
    controller.start();
    expect(mount).not.toHaveBeenCalled();
    expect(controller.model).toMatchObject({ status: "none", notice: null });
  });
});

describe("tiers and slow networks", () => {
  it("loads normally on a fast network", () => {
    expect(decideSceneAction({ hasScene: true, webgl: true, effectiveType: "4g" })).toBe("load");
    expect(decideSceneAction({ hasScene: true, webgl: true })).toBe("load");
  });

  it("picks the low tier on save-data and on 3g or slower", () => {
    expect(decideSceneAction({ hasScene: true, webgl: true, saveData: true })).toBe("load-low");
    for (const effectiveType of ["slow-2g", "2g", "3g"]) {
      expect(decideSceneAction({ hasScene: true, webgl: true, effectiveType })).toBe("load-low");
    }
  });

  it("fetches the low tier file on a slow network and the normal file otherwise", () => {
    const urls: string[] = [];
    const mount = (a: MountArgs): SceneHandle => {
      urls.push(a.url);
      return handle(new Promise(() => undefined));
    };
    controllerWith(mount, { env: { webgl: true, effectiveType: "2g" } }).start();
    controllerWith(mount, { env: { webgl: true, effectiveType: "4g" } }).start();
    expect(urls).toEqual(["/media/cafe/scene-100k.spz", "/media/cafe/scene-500k.spz"]);
  });

  it("falls back to the normal file when there is no low tier", () => {
    const scene = { file: "a.spz", format: "spz", spawn: { position: [0, 0, 0], lookAt: [0, 0, -1] } } as NonNullable<Scenario["place"]["scene"]>;
    expect(pickSceneFile(scene, "load-low")).toBe("a.spz");
    expect(pickSceneFile({ ...scene, tiers: { default: "b.spz" } }, "load")).toBe("b.spz");
  });

  it("reads the browser's connection hints", () => {
    expect(readConnection({ connection: { saveData: true, effectiveType: "3g" } })).toEqual({ saveData: true, effectiveType: "3g" });
    expect(readConnection(undefined)).toEqual({ saveData: undefined, effectiveType: undefined });
  });
});

describe("pausing and leaving", () => {
  it("renders only while the tab is visible and the header is open", () => {
    expect(shouldRender({ hidden: false, collapsed: false })).toBe(true);
    expect(shouldRender({ hidden: true, collapsed: false })).toBe(false);
    expect(shouldRender({ hidden: false, collapsed: true })).toBe(false);
  });

  it("pauses when hidden or collapsed, resumes after, and disposes on leaving", () => {
    const h = handle(new Promise(() => undefined));
    const controller = controllerWith(() => h);
    controller.start();
    controller.setHidden(true);
    controller.setHidden(false);
    controller.setCollapsed(true);
    controller.setHidden(true);
    controller.setCollapsed(false);
    controller.setHidden(false);
    expect(h.calls).toEqual(["resume", "pause", "resume", "pause", "pause", "pause", "resume"]);
    controller.dispose();
    expect(h.calls.at(-1)).toBe("dispose");
  });
});
