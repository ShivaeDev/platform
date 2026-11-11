import { Schema } from "effect";
import { type Decoded, decodeWith } from "#decoded.ts";
import { keyOf } from "#engine/violation.ts";

const Line = Schema.Struct({
	count: Schema.Int.check(Schema.isGreaterThan(0)),
	deep: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
	path: Schema.NonEmptyString,
	reason: Schema.optionalKey(Schema.NonEmptyString),
	rule: Schema.NonEmptyString,
});

const BaselineLine = Schema.fromJsonString(Line);

export interface BaselineEntry {
	readonly count: number;
	readonly deep?: number;
	readonly file: string;
	readonly reason?: string;
	readonly rule: string;
}

function codepoints(left: string, right: string): number {
	return left < right ? -1 : Number(left > right);
}

export function byPathAndRule(left: BaselineEntry, right: BaselineEntry): number {
	return codepoints(left.file, right.file) || codepoints(left.rule, right.rule);
}

export function linesOf(raw: string | undefined): ReadonlyArray<{ readonly line: number; readonly text: string }> {
	return (raw ?? "")
		.split("\n")
		.map((text, index) => ({ line: index + 1, text }))
		.filter((row) => row.text.trim() !== "");
}

export function decodeBaseline(raw: string | undefined): Decoded<readonly BaselineEntry[]> {
	const issues: string[] = [];
	const entries: BaselineEntry[] = [];
	const seen = new Set<string>();
	for (const { line, text } of linesOf(raw)) {
		const decoded = decodeWith(BaselineLine, text);
		if (decoded._tag === "Invalid") {
			issues.push(...decoded.issues.map((issue) => `line ${line}: ${issue}`));
			continue;
		}
		const { path, ...stored } = decoded.value;
		if (stored.deep !== undefined && stored.deep > stored.count) {
			issues.push(`line ${line}: records ${stored.deep} deep findings of a count of ${stored.count}`);
		}
		if (seen.has(keyOf(stored.rule, path))) {
			issues.push(`line ${line}: repeats the entry for ${stored.rule} in ${path}`);
		}
		seen.add(keyOf(stored.rule, path));
		entries.push({ ...stored, file: path });
	}
	return issues.length === 0 ? { _tag: "Valid", value: entries } : { _tag: "Invalid", issues };
}

const LINE_KEYS = ["path", "rule", "count", "deep", "reason"];

export function encodeEntry(entry: BaselineEntry): string {
	return JSON.stringify({ count: entry.count, deep: entry.deep, path: entry.file, reason: entry.reason, rule: entry.rule }, LINE_KEYS);
}

export function encodeBaseline(entries: readonly BaselineEntry[]): string {
	return [...entries]
		.sort(byPathAndRule)
		.map((entry) => `${encodeEntry(entry)}\n`)
		.join("");
}
