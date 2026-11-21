// Bundled scenarios. Vite reads the files at build time, so no request is made for them.
import { validateScenario, type Scenario } from "../scenario/validate";

export interface ScenarioEntry {
  scenario: Scenario;
  /** True when a fluent speaker has signed the scenario (docs/spec.md section 4.1). */
  listed: boolean;
}

/** Valid scenarios only, sorted by title. Invalid files are skipped and reported to the console. */
export function entriesFromInputs(inputs: unknown[], onInvalid?: (errors: string[]) => void): ScenarioEntry[] {
  const out: ScenarioEntry[] = [];
  for (const input of inputs) {
    const result = validateScenario(input);
    if (result.valid) out.push({ scenario: result.scenario, listed: result.listed });
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

export function findScenario(id: string, dev: boolean = import.meta.env.DEV): ScenarioEntry | undefined {
  return availableEntries(bundledScenarios(), dev).find((e) => e.scenario.id === id);
}
