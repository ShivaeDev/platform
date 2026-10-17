import { Effect, Schema } from "effect";
import { legacyColumns } from "#storage/legacyColumns.ts";

export const textRecordValue = Effect.fn("FleetStore.textRecordValue")(function* (
	row: Readonly<Record<string, unknown>>,
	structured: readonly string[],
) {
	const value: Record<string, unknown> = {};
	for (const name of Object.keys(legacyColumns)) {
		const field = row[structured.includes(name) ? `legacy_${name}` : name];
		if (field !== null) {
			value[name] = structured.includes(name) ? yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(field) : field;
		}
	}
	return value;
});
