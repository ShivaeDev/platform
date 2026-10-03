import { keyOf } from "../engine/violation.ts";
import { type BaselineEntry, byPathAndRule, encodeEntry, linesOf } from "./format.ts";

interface Row {
	readonly entry: BaselineEntry;
	readonly text: string;
}

const same = (left: BaselineEntry, right: BaselineEntry): boolean => left.count === right.count && left.measure === right.measure;

// An untouched entry keeps its exact line and a new one goes before the first line that sorts after it, so two branches conflict only on the same or neighbouring entries.
export const rewriteBaseline = (raw: string | undefined, before: ReadonlyArray<BaselineEntry>, after: ReadonlyArray<BaselineEntry>): string => {
	const wanted = new Map(after.map((entry) => [keyOf(entry.rule, entry.file), entry]));
	const lines = linesOf(raw);
	const rows: Row[] = before.flatMap((old, index) => {
		const entry = wanted.get(keyOf(old.rule, old.file));
		const line = lines[index];
		wanted.delete(keyOf(old.rule, old.file));
		return entry === undefined ? [] : [{ entry, text: line !== undefined && same(old, entry) ? line.text : encodeEntry(entry) }];
	});
	for (const entry of [...wanted.values()].sort(byPathAndRule)) {
		const at = rows.findIndex((row) => byPathAndRule(row.entry, entry) > 0);
		rows.splice(at === -1 ? rows.length : at, 0, { entry, text: encodeEntry(entry) });
	}
	return rows.map((row) => `${row.text}\n`).join("");
};
