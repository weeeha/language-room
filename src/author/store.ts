// Scenarios made in the browser. They live in IndexedDB, in the "scenarios" store, and
// nowhere else: there are no accounts and no server storage (docs/spec.md section 2).
import { DB_NAME, openDb } from "../storage/db";
import type { Scenario } from "../scenario/validate";

export interface LocalScenario {
  id: string;
  updatedAt: number;
  scenario: Scenario;
}

export interface ScenarioStore {
  list(): Promise<LocalScenario[]>;
  get(id: string): Promise<LocalScenario | undefined>;
  put(scenario: Scenario): Promise<void>;
  remove(id: string): Promise<void>;
}

export function createMemoryScenarioStore(): ScenarioStore {
  const map = new Map<string, LocalScenario>();
  return {
    async list() {
      return [...map.values()].map((x) => structuredClone(x));
    },
    async get(id) {
      const found = map.get(id);
      return found ? structuredClone(found) : undefined;
    },
    async put(scenario) {
      map.set(scenario.id, { id: scenario.id, updatedAt: Date.now(), scenario: structuredClone(scenario) });
    },
    async remove(id) {
      map.delete(id);
    },
  };
}

const STORE = "scenarios";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export function createIndexedDbScenarioStore(dbName = DB_NAME): ScenarioStore {
  async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await openDb(dbName);
    return db.transaction(STORE, mode).objectStore(STORE);
  }
  return {
    async list() {
      const all = (await request((await store("readonly")).getAll())) as LocalScenario[];
      return all.sort((a, b) => a.scenario.title.localeCompare(b.scenario.title));
    },
    async get(id) {
      return (await request((await store("readonly")).get(id))) as LocalScenario | undefined;
    },
    async put(scenario) {
      const record: LocalScenario = { id: scenario.id, updatedAt: Date.now(), scenario };
      await request((await store("readwrite")).put(record));
    },
    async remove(id) {
      await request((await store("readwrite")).delete(id));
    },
  };
}

let shared: ScenarioStore | undefined;
export function getScenarioStore(): ScenarioStore {
  shared ??= createIndexedDbScenarioStore();
  return shared;
}
