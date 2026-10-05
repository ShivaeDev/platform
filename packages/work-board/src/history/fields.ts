import type { Metadata } from "#metadata/schema.ts";
import type { HistoryDocument } from "./documents.ts";

const labels: ReadonlyArray<readonly [keyof Metadata, string]> = [
	["attention", "Recorded attention requests changed"],
	["criteria", "Criteria changed"],
	["evidence", "Recorded evidence changed (not verified acceptance)"],
	["id", "Item ID changed"],
	["items", "Declared board membership changed"],
	["kind", "Item kind changed"],
	["nextAction", "Next action changed"],
	["owner", "Recorded owner changed (not authorship)"],
	["relationships", "Explicit relationships changed"],
	["status", "Recorded status changed (not acceptance)"],
];

export function historyFields(before: HistoryDocument, after: HistoryDocument): readonly string[] {
	const changes = labels.flatMap(([field, label]) =>
		JSON.stringify(before.parsed.fields[field]) === JSON.stringify(after.parsed.fields[field]) ? [] : [label],
	);
	if (before.parsed.body !== after.parsed.body) {
		const decision = before.parsed.fields.kind === "decision" || after.parsed.fields.kind === "decision";
		changes.push(decision ? "Decision Markdown changed" : "Markdown body changed");
	}
	if (changes.length === 0 && before.source !== after.source) {
		changes.push("Other frontmatter content or source formatting changed; no further interpretation");
	}
	if (before.file !== after.file) {
		changes.unshift("Source path changed for the same unique item ID");
	}
	return changes;
}
