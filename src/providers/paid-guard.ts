export class PaidProviderBlockedError extends Error {
  providerId: string;
  constructor(providerId: string) {
    super(`Paid provider "${providerId}" is blocked because paid providers are off`);
    this.name = "PaidProviderBlockedError";
    this.providerId = providerId;
  }
}

/** Paid providers are allowed only for the exact string "on". */
export function isPaidAllowed(flag: string | undefined): boolean {
  return flag === "on";
}

export function assertPaidAllowed(
  provider: { id: string; paid: boolean },
  flag: string | undefined,
): void {
  if (provider.paid && !isPaidAllowed(flag)) {
    throw new PaidProviderBlockedError(provider.id);
  }
}

/**
 * Returns a proxy where every method call checks the flag first.
 * The check runs synchronously, before the adapter code and any fetch.
 */
export function guardProvider<T extends { id: string; paid: boolean }>(
  provider: T,
  getFlag: () => string | undefined,
): T {
  if (!provider.paid) return provider;
  return new Proxy(provider, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        assertPaidAllowed(target, getFlag());
        return Reflect.apply(value, target, args) as unknown;
      };
    },
  });
}
