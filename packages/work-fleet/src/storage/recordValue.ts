import { Effect, Result, Schema } from "effect";
import type { recordColumns } from "#storage/model.ts";

const decodeJson = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Unknown));

function jsonValue(value: unknown) {
	try {
		return typeof value === "string" ? Result.succeed(JSON.parse(value)) : decodeJson(value);
	} catch {
		return decodeJson(value);
	}
}

export const recordValues = Effect.fn("FleetRow.recordValues")(function* (rows: readonly object[], columns: ReturnType<typeof recordColumns>) {
	const entries = Object.entries(columns);
	const records: Record<string, unknown>[] = [];
	for (const row of rows) {
		const values: Record<string, unknown> = { ...row };
		const fields: Record<string, unknown> = { workId: values.work_id };
		for (const [name, kind] of entries) {
			const value = values[name];
			if (value === null || value === undefined) {
				continue;
			}
			if (kind !== "json") {
				fields[name] = value;
				continue;
			}
			const decoded = jsonValue(value);
			if (decoded._tag === "Failure") {
				return yield* Effect.fail(decoded.failure);
			}
			fields[name] = decoded.success;
		}
		records.push(fields);
	}
	return records;
});

export function recordValue(row: object, columns: ReturnType<typeof recordColumns>) {
	return recordValues([row], columns).pipe(Effect.map(([value]) => value));
}
