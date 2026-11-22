// Bundled scenarios. Vite reads the files at build time, so no request is made for them.
import { getScenarioStore, type LocalScenario, type ScenarioStore } from "../author/store";
import { validateScenario, type Scenario } from "../scenario/validate";

export interface ScenarioEntry {
  scenario: Scenario;
  /** True when a fluent speaker has signed the scenario (docs/spec.md section 4.1). */
  listed: boolean;
  /** Bundled files are read-only. Local scenarios were made or imported in this browser. */
  source?: "bundled" | "local";
}

/** Valid scenarios only, sorted by title. Invalid files are skipped and reported to the console. */
export function entriesFromInputs(inputs: unknown[], onInvalid?: (errors: string[]) => void): ScenarioEntry[] {
  const out: ScenarioEntry[] = [];
  for (const input of inputs) {
    const result = validateScenario(input);
    if (result.valid) out.push({ scenario: result.scenario, listed: result.listed, source: "bundled" });
    else onInvalid?.(result.errors);
  }
  return out.sort((a, b) => a.scenario.title.localeCompare(b.scenario.title));
}

/** What a visitor may open. Unlisted scenarios are open only in development. */
export function availableEntries(entries: ScenarioEntry[], dev: boolean): ScenarioEntry[] {
  return entries.filter((e) => e.listed || dev);
}

let cached: ScenarioEntry[] | undefined;

export function bundledScenarios(): ScenarioEntry[] {
  if (!cached) {
    const modules = import.meta.glob("/scenarios/*.json", { eager: true, import: "default" });
    cached = entriesFromInputs(Object.values(modules), (errors) => {
      console.warn("A scenario file was skipped", errors);
    });
  }
  return cached;
}

/** A bundled scenario by id. A direct link opens it in every build, reviewed or not. */
export function findScenario(id: string): ScenarioEntry | undefined {
  return bundledScenarios().find((e) => e.scenario.id === id);
}

/**
 * What the library lists: reviewed scenarios only, bundled and local, sorted by title.
 * A local scenario never takes the place of a bundled one with the same id.
 */
export function libraryEntries(bundled: ScenarioEntry[], local: ScenarioEntry[]): ScenarioEntry[] {
  const ids = new Set(bundled.map((e) => e.scenario.id));
  return [...bundled, ...local.filter((e) => !ids.has(e.scenario.id))]
    .filter((e) => e.listed)
    .sort((a, b) => a.scenario.title.localeCompare(b.scenario.title));
}

/** Every local scenario that still validates. */
export async function localEntries(store: ScenarioStore = getScenarioStore()): Promise<ScenarioEntry[]> {
  try {
    const out: ScenarioEntry[] = [];
    for (const record of await store.list()) {
      const entry = localEntry(record);
      if (entry) out.push(entry);
    }
    return out;
  } catch {
    return [];
  }
}

/** The entry for a scenario made or imported in this browser. A record that no longer validates is skipped. */
export function localEntry(record: LocalScenario): ScenarioEntry | undefined {
  const result = validateScenario(record.scenario);
  return result.valid ? { scenario: result.scenario, listed: result.listed, source: "local" } : undefined;
}

/** Bundled files first, then the local store. Bundled ids cannot be shadowed by a local copy. */
export async function resolveScenario(id: string, store: ScenarioStore = getScenarioStore()): Promise<ScenarioEntry | undefined> {
  const bundled = findScenario(id);
  if (bundled) return bundled;
  try {
    const record = await store.get(id);
    return record ? localEntry(record) : undefined;
  } catch {
    return undefined;
  }
}
