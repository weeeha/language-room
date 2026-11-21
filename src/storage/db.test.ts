import { describe, expect, it } from "vitest";
import { DB_VERSION, missingStores } from "./db";

describe("database upgrade", () => {
  it("creates both stores in a new database", () => {
    expect(missingStores([])).toEqual(["sessions", "scenarios"]);
  });
  it("adds only scenarios to a version 1 database and leaves sessions alone", () => {
    expect(missingStores(["sessions"])).toEqual(["scenarios"]);
  });
  it("adds nothing to a version 2 database", () => {
    expect(missingStores(["sessions", "scenarios"])).toEqual([]);
    expect(DB_VERSION).toBe(2);
  });
});
