import { escapeHtml } from "#browser/escapeHtml.ts";
import type { HistoryOutput } from "#history/schema.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { observeBaseline, readBaseline } from "./baseline.ts";
import { compareHistory } from "./compare.ts";
import { historyHtml } from "./html.ts";

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
	const compared = prior.baseline && current ? compareHistory(prior.baseline, current) : undefined;
	const comparison =
		compared && prior.baseline
			? {
					changes: compared.changes.map(({ before, after, ...change }) => ({
						...change,
						after: after ? { file: after.file, source: after.source } : undefined,
						before: before ? { file: before.file, source: before.source } : undefined,
					})),
					issues: compared.issues,
					recordedAt: prior.baseline.recordedAt,
				}
			: undefined;
	return { ...output, comparison, html: prior.baseline && current ? historyHtml(prior.baseline, current) : output.html, snapshot: currentRaw };
}
