import { describe, expect, it } from "vitest";
import { createSentenceChunker } from "./chunker";

function run(deltas: string[], flush = true): string[] {
  const out: string[] = [];
  const c = createSentenceChunker((s) => out.push(s));
  for (const d of deltas) c.push(d);
  if (flush) c.flush();
  return out;
}

describe("createSentenceChunker", () => {
  it("emits a sentence once its end and following white space arrive", () => {
    const out: string[] = [];
    const c = createSentenceChunker((s) => out.push(s));
    c.push("Bom dia.");
    expect(out).toEqual([]);
    c.push(" O que");
    expect(out).toEqual(["Bom dia."]);
    c.push(" vai ser?");
    expect(out).toEqual(["Bom dia."]);
    c.flush();
    expect(out).toEqual(["Bom dia.", "O que vai ser?"]);
  });

  it("handles a sentence split across many deltas", () => {
    expect(run(["B", "om ", "dia", ".", " ", "Diga", ", faz favor", "."])).toEqual([
      "Bom dia.",
      "Diga, faz favor.",
    ]);
  });

  it("does not split decimals", () => {
    expect(run(["O pastel custa 1,30. ", "Ou 2.50 com café."])).toEqual([
      "O pastel custa 1,30.",
      "Ou 2.50 com café.",
    ]);
    expect(run(["São 2.", "50 euros. Obrigada."])).toEqual(["São 2.50 euros.", "Obrigada."]);
  });

  it("splits at question marks", () => {
    expect(run(["Quer um café? Quer um pastel de nata? Sim."])).toEqual([
      "Quer um café?",
      "Quer um pastel de nata?",
      "Sim.",
    ]);
  });

  it("flushes a trailing fragment and never emits empty strings", () => {
    expect(run(["Já trago", " o café"])).toEqual(["Já trago o café"]);
    expect(run(["   ", "\n"])).toEqual([]);
    expect(run(["Olá.  \n  "])).toEqual(["Olá."]);
    expect(run([])).toEqual([]);
  });

  it("flush twice emits nothing the second time", () => {
    const out: string[] = [];
    const c = createSentenceChunker((s) => out.push(s));
    c.push("Olá");
    c.flush();
    c.flush();
    expect(out).toEqual(["Olá"]);
  });
});
