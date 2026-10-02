import { Schema } from "effect";
import { type Decoded, decodeWith } from "../decoded.ts";

const Entry = Schema.Struct({
	count: Schema.Int.check(Schema.isGreaterThan(0)),
	measure: Schema.optionalKey(Schema.Finite),
});

const BaselineFile = Schema.Record(Schema.String, Schema.Record(Schema.String, Entry));

const standard = Schema.toStandardSchemaV1(Schema.fromJsonString(BaselineFile), { parseOptions: { errors: "all", onExcessProperty: "error" } });

export interface BaselineEntry {
	readonly rule: string;
	readonly file: string;
	readonly count: number;
	readonly measure?: number | undefined;
}

type Stored = typeof Entry.Type;

const codepoints = (left: string, right: string): number => (left < right ? -1 : Number(left > right));

export const byRuleAndFile = (left: BaselineEntry, right: BaselineEntry): number =>
	codepoints(left.rule, right.rule) || codepoints(left.file, right.file);

export const decodeBaseline = async (raw: string | undefined): Promise<Decoded<ReadonlyArray<BaselineEntry>>> => {
	if (raw === undefined) {
		return { _tag: "Valid", value: [] };
	}
	const decoded = await decodeWith(standard, raw);
	if (decoded._tag === "Invalid") {
		return decoded;
	}
	const entries = Object.entries(decoded.value).flatMap(([rule, files]) =>
		Object.entries(files).map(([file, stored]) => ({ ...stored, file, rule })),
	);
	return { _tag: "Valid", value: entries };
};

const stored = (entry: BaselineEntry): Stored =>
	entry.measure === undefined ? { count: entry.count } : { count: entry.count, measure: entry.measure };

export const encodeBaseline = (entries: ReadonlyArray<BaselineEntry>, indent: string): string => {
	const rules: Record<string, Record<string, Stored>> = {};
	for (const entry of [...entries].sort(byRuleAndFile)) {
		rules[entry.rule] = { ...rules[entry.rule], [entry.file]: stored(entry) };
	}
	return `${JSON.stringify(rules, null, indent)}\n`;
};

// The repository formatter leaves the file alone only while it keeps its own indentation.
export const indentOf = (raw: string | undefined): string => /^([ \t]+)\S/m.exec(raw ?? "")?.[1] ?? "\t";
