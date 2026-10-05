import { escapeHtml } from "#page/escape.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { observeBaseline, readBaseline } from "./baseline.ts";
import { historyHtml } from "./html.ts";
import type { HistoryOutput } from "./schema.ts";

export function historyResponse(raw: string | null, now: number, snapshot?: Snapshot): HistoryOutput {
	const prior = readBaseline(raw, now);
	const output: HistoryOutput = { discardBaseline: prior.discard, html: `<p>${escapeHtml(prior.reason)}</p>`, reason: prior.reason, snapshot: null };
	if (snapshot === undefined) {
		return output;
	}
	const currentRaw = observeBaseline(snapshot, now);
	if (currentRaw === undefined) {
		const reason =
			snapshot.unavailable.length > 0
				? "Current workspace observation is incomplete; no comparison or removals are inferred. Your valid remembered snapshot is preserved."
				: "Complete current snapshot exceeds 2 MiB; no comparison or partial history is retained.";
		return { ...output, html: `<p role="status">${escapeHtml(reason)}</p>`, reason };
	}
	const current = readBaseline(currentRaw, now).baseline;
	return { ...output, html: prior.baseline && current ? historyHtml(prior.baseline, current) : output.html, snapshot: currentRaw };
}
