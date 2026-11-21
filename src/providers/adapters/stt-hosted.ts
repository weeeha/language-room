import type { SttProvider, SttResult } from "../stt";

/** Paid stub. The server answers 501 in this build. */
export function createHostedStt(): SttProvider {
  return {
    kind: "stt",
    id: "stt-hosted",
    label: "Hosted speech to text (paid)",
    paid: true,
    async listenOnce(opts): Promise<SttResult> {
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang: opts.lang }),
        signal: opts.signal,
      });
      const data = (await res.json().catch(() => ({}))) as SttResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Hosted STT failed with ${res.status}`);
      return data;
    },
  };
}
