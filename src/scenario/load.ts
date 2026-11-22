import { validateScenario, type Scenario, type ValidationResult } from "./validate";

// Accepts a JSON string or an already parsed value. Pure: no file or network access.
export function loadScenario(json: string | unknown): ValidationResult {
  if (typeof json !== "string") return validateScenario(json);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { valid: false, errors: [`json: could not parse (${reason})`] };
  }
  return validateScenario(parsed);
}

// Only valid scenarios that a reviewer has signed off appear in the library.
export function listScenarios(inputs: unknown[]): Scenario[] {
  const out: Scenario[] = [];
  for (const input of inputs) {
    const result = loadScenario(input);
    if (result.valid && result.listed) out.push(result.scenario);
  }
  return out;
}
