import { type HistoryDocument, historyDocuments, historyIdentities } from "./documents.ts";
import { historyFields } from "./fields.ts";
import type { Baseline } from "./schema.ts";

export interface SourceChange {
	readonly after?: HistoryDocument;
	readonly before?: HistoryDocument;
	readonly kind: "added" | "removed" | "changed";
	readonly reasons: readonly string[];
}

export function compareHistory(baseline: Baseline, current: Baseline) {
	const before = historyDocuments(baseline);
	const after = historyDocuments(current);
	const oldIds = historyIdentities(before);
	const newIds = historyIdentities(after);
	const paired = new Set<HistoryDocument>();
	const remaining = new Set(after);
	const changes: SourceChange[] = [];
	function pair(old: HistoryDocument, next: HistoryDocument) {
		paired.add(old);
		remaining.delete(next);
		if (old.source !== next.source || old.file !== next.file) {
			changes.push({ after: next, before: old, kind: "changed", reasons: historyFields(old, next) });
		}
	}
	for (const [id, old] of oldIds) {
		const next = newIds.get(id);
		if (old && next) {
			pair(old, next);
		}
	}
	const byFile = new Map([...remaining].map((document) => [document.file, document]));
	for (const old of before) {
		if (paired.has(old)) {
			continue;
		}
		const next = byFile.get(old.file);
		if (next) {
			pair(old, next);
		} else {
			changes.push({ before: old, kind: "removed", reasons: ["Source absent from the complete current observation"] });
		}
	}
	for (const next of remaining) {
		changes.push({ after: next, kind: "added", reasons: ["Source added since the remembered observation"] });
	}
	const issues = [
		...[...oldIds].filter(([, document]) => !document).map(([id]) => `Duplicate ID ${id} in remembered sources; no identity winner selected.`),
		...[...newIds].filter(([, document]) => !document).map(([id]) => `Duplicate ID ${id} in current sources; no identity winner selected.`),
	];
	changes.sort((a, b) => (a.after?.file ?? a.before?.file ?? "").localeCompare(b.after?.file ?? b.before?.file ?? "", "en"));
	return { changes, issues, newIds };
}
