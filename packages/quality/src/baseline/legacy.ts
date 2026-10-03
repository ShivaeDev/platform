import { Schema } from "effect";
import { type Decoded, decodeWith } from "../decoded.ts";
import { groupBy, keyOf, type Violation } from "../engine/violation.ts";
import { countOf } from "./compare.ts";
import type { BaselineEntry } from "./format.ts";

export const LEGACY_BASELINE = "quality/baseline.json";

const Entry = Schema.Struct({
	count: Schema.Int.check(Schema.isGreaterThan(0)),
	measure: Schema.optionalKey(Schema.Finite),
});

const LegacyFile = Schema.Record(Schema.String, Schema.Record(Schema.String, Entry));

const standard = Schema.toStandardSchemaV1(Schema.fromJsonString(LegacyFile), { parseOptions: { errors: "all", onExcessProperty: "error" } });

export interface LegacyEntry extends BaselineEntry {
	readonly measure?: number | undefined;
}

export const decodeLegacyBaseline = async (raw: string): Promise<Decoded<ReadonlyArray<LegacyEntry>>> => {
	const decoded = await decodeWith(standard, raw);
	if (decoded._tag === "Invalid") {
		return decoded;
	}
	const entries = Object.entries(decoded.value).flatMap(([rule, files]) =>
		Object.entries(files).map(([file, stored]) => ({ ...stored, file, rule })),
	);
	return { _tag: "Valid", value: entries };
};

export const measured = (legacy: ReadonlyArray<LegacyEntry>): boolean => legacy.some((entry) => entry.measure !== undefined);

export const convertLegacy = (legacy: ReadonlyArray<LegacyEntry>, violations: ReadonlyArray<Violation>): ReadonlyArray<BaselineEntry> => {
	const current = groupBy(violations, (violation) => keyOf(violation.rule, violation.file));
	return legacy.flatMap(({ count, file, measure, rule }) => {
		if (measure === undefined) {
			return [{ count, file, rule }];
		}
		const group = current.get(keyOf(rule, file)) ?? [];
		const threshold = group.find((violation) => violation.threshold !== undefined)?.threshold;
		const converted = threshold === undefined ? countOf(group) : Math.ceil(measure - threshold);
		return converted > 0 ? [{ count: converted, file, rule }] : [];
	});
};
