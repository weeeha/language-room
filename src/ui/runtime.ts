// Shared setup: server config, providers and the session store.
import { createIndexedDbStore, type SessionStore } from "../conversation/session";
import { getProviders, type Providers } from "../providers";

export interface Runtime {
  providers: Providers;
  /** The raw flag from the server. Paid providers run only when it is exactly "on". */
  paidProviders: string;
}

let runtime: Promise<Runtime> | undefined;

/** Reads /api/config once. When the server cannot be reached, paid providers stay off. */
export function loadRuntime(): Promise<Runtime> {
  runtime ??= (async () => {
    let paidProviders = "off";
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = (await res.json()) as { paidProviders?: string };
        if (typeof data.paidProviders === "string") paidProviders = data.paidProviders;
      }
    } catch {
      // Keep the safe default.
    }
    return { providers: getProviders({ paidProviders }), paidProviders };
  })();
  return runtime;
}

let store: SessionStore | undefined;

export function getStore(): SessionStore {
  store ??= createIndexedDbStore();
  return store;
}
