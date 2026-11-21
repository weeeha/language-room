// Session log (docs/spec.md section 4.2). Text and timings only: audio is never stored.
import type { Issue } from "./corrections";

export interface Turn {
  id: string;
  role: "learner" | "character";
  text: string;
  heardText?: string;
  confirmed?: boolean;
  at: number;
  latencyMs?: number;
  level?: { averageWords: number; flagged: boolean };
  ttsFailed?: boolean;
  reported?: boolean;
}

export interface Session {
  id: string;
  scenarioId: string;
  scenarioVersion: number;
  startedAt: number;
  endedAt?: number;
  endReason?: "goal" | "learner";
  turns: Turn[];
  issues: Issue[];
  stepsDone: string[];
  providers: { stt: string; llm: string; analyzer: string; reviewer: string; tts: string };
  errors: { at: number; where: string; message: string }[];
}

export interface SessionStore {
  save(session: Session): Promise<void>;
  get(id: string): Promise<Session | undefined>;
  list(): Promise<Session[]>;
}

/** Keeps sessions in memory. It stores and returns copies. */
export function createMemoryStore(): SessionStore {
  const map = new Map<string, Session>();
  return {
    async save(session) {
      map.set(session.id, structuredClone(session));
    },
    async get(id) {
      const found = map.get(id);
      return found ? structuredClone(found) : undefined;
    },
    async list() {
      return [...map.values()].map((s) => structuredClone(s));
    },
  };
}

const STORE_NAME = "sessions";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

/** Keeps sessions in the browser. Checked in the browser in part 2, not in Node. */
export function createIndexedDbStore(dbName = "language-room"): SessionStore {
  let opened: Promise<IDBDatabase> | undefined;
  function open(): Promise<IDBDatabase> {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB could not open"));
    });
    return opened;
  }
  async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await open();
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }
  return {
    async save(session) {
      await request((await store("readwrite")).put(session));
    },
    async get(id) {
      return (await request((await store("readonly")).get(id))) as Session | undefined;
    },
    async list() {
      return (await request((await store("readonly")).getAll())) as Session[];
    },
  };
}

/** Median latencyMs over character turns that have one, or null when none do. */
export function medianLatency(session: Session): number | null {
  const values = session.turns
    .filter((t) => t.role === "character" && typeof t.latencyMs === "number")
    .map((t) => t.latencyMs as number)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? (values[mid] as number) : ((values[mid - 1] as number) + (values[mid] as number)) / 2;
}
