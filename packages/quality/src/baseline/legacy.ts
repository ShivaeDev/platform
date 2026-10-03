import { Schema } from "effect";
import { type Decoded, decodeWith } from "../decoded.ts";
import type { BaselineEntry } from "./format.ts";

export const LEGACY_BASELINE = "quality/baseline.json";

const Entry = Schema.Struct({
	count: Schema.Int.check(Schema.isGreaterThan(0)),
	measure: Schema.optionalKey(Schema.Finite),
});

const LegacyFile = Schema.Record(Schema.String, Schema.Record(Schema.String, Entry));

const standard = Schema.toStandardSchemaV1(Schema.fromJsonString(LegacyFile), { parseOptions: { errors: "all", onExcessProperty: "error" } });

export const decodeLegacyBaseline = async (raw: string): Promise<Decoded<ReadonlyArray<BaselineEntry>>> => {
	const decoded = await decodeWith(standard, raw);
	if (decoded._tag === "Invalid") {
		return decoded;
	}
	const entries = Object.entries(decoded.value).flatMap(([rule, files]) =>
		Object.entries(files).map(([file, stored]) => ({ ...stored, file, rule })),
	);
	return { _tag: "Valid", value: entries };
};
