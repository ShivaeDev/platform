import { Schema } from "effect";
import { type Decoded, decodeWith } from "../decoded.ts";
import { keyOf } from "../engine/violation.ts";

const Line = Schema.Struct({
	path: Schema.NonEmptyString,
	rule: Schema.NonEmptyString,
	count: Schema.Int.check(Schema.isGreaterThan(0)),
	measure: Schema.optionalKey(Schema.Finite),
});

const standard = Schema.toStandardSchemaV1(Schema.fromJsonString(Line), { parseOptions: { errors: "all", onExcessProperty: "error" } });

export interface BaselineEntry {
	readonly rule: string;
	readonly file: string;
	readonly count: number;
	readonly measure?: number | undefined;
}

const codepoints = (left: string, right: string): number => (left < right ? -1 : Number(left > right));

export const byPathAndRule = (left: BaselineEntry, right: BaselineEntry): number =>
	codepoints(left.file, right.file) || codepoints(left.rule, right.rule);

export const linesOf = (raw: string | undefined): ReadonlyArray<{ readonly line: number; readonly text: string }> =>
	(raw ?? "")
		.split("\n")
		.map((text, index) => ({ line: index + 1, text }))
		.filter((row) => row.text.trim() !== "");

export const decodeBaseline = async (raw: string | undefined): Promise<Decoded<ReadonlyArray<BaselineEntry>>> => {
	const issues: string[] = [];
	const entries: BaselineEntry[] = [];
	const seen = new Set<string>();
	for (const { line, text } of linesOf(raw)) {
		const decoded = await decodeWith(standard, text);
		if (decoded._tag === "Invalid") {
			issues.push(...decoded.issues.map((issue) => `line ${line}: ${issue}`));
			continue;
		}
		const { path, ...stored } = decoded.value;
		if (seen.has(keyOf(stored.rule, path))) {
			issues.push(`line ${line}: repeats the entry for ${stored.rule} in ${path}`);
		}
		seen.add(keyOf(stored.rule, path));
		entries.push({ ...stored, file: path });
	}
	return issues.length === 0 ? { _tag: "Valid", value: entries } : { _tag: "Invalid", issues };
};

export const encodeEntry = (entry: BaselineEntry): string =>
	JSON.stringify(
		entry.measure === undefined
			? { path: entry.file, rule: entry.rule, count: entry.count }
			: { path: entry.file, rule: entry.rule, count: entry.count, measure: entry.measure },
	);

export const encodeBaseline = (entries: ReadonlyArray<BaselineEntry>): string =>
	[...entries]
		.sort(byPathAndRule)
		.map((entry) => `${encodeEntry(entry)}\n`)
		.join("");
