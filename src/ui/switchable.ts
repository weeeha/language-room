// Provider wrappers for the conversation: the provider can change while the page is open, calls are
// counted, and a hook can watch the start and end of a call. Also the paid-provider check for the picker.
import { assertPaidAllowed, PaidProviderBlockedError } from "../providers/paid-guard";

export type Around = (call: () => unknown) => unknown;

/**
 * Returns an object that reads the current provider on every access.
 * `around` maps a method name to a wrapper that runs the call, so callers can count it or time it.
 */
export function switchable<T extends object>(getCurrent: () => T, around: Record<string, Around> = {}): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const current = getCurrent();
      const value = Reflect.get(current, prop) as unknown;
      if (typeof value !== "function") return value;
      const name = String(prop);
      return (...args: unknown[]): unknown => {
        const call = (): unknown => Reflect.apply(value, current, args);
        const wrap = around[name];
        return wrap ? wrap(call) : call();
      };
    },
  });
}

export type SelectResult = { ok: true } | { ok: false; message: string };

/** The paid-provider check for the debug footer picker (docs/spec.md section 6, criterion 13). */
export function checkSelectable(provider: { id: string; label: string; paid: boolean }, paidFlag: string | undefined): SelectResult {
  try {
    assertPaidAllowed(provider, paidFlag);
    return { ok: true };
  } catch (e) {
    if (e instanceof PaidProviderBlockedError) {
      return { ok: false, message: `Paid providers are off. ${provider.label} was not used.` };
    }
    throw e;
  }
}
