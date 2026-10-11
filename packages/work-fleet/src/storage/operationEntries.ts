import { Effect, Schema } from "effect";
import { Attempt, FleetRecord } from "#model.ts";
import { recordValues } from "#storage/recordValue.ts";

const OperationAttempts = Schema.Array(Schema.Struct({ operationId: Attempt.fields.operationId }));
const decode = Schema.decodeUnknownEffect(
	Schema.Array(
		Schema.Struct({
			attempts: OperationAttempts,
			history: Schema.optional(Schema.Array(Schema.Struct({ attempts: OperationAttempts }))),
			version: Schema.Number,
			workId: FleetRecord.fields.workId,
		}),
	),
);

export const operationEntries = Effect.fn("FleetRow.operationEntries")(function* (rows: readonly object[], operationId: string) {
	const records = yield* decode(yield* recordValues(rows, { attempts: "json", history: "json", version: "number" }));
	return records.flatMap((record) =>
		[...(record.history ?? []).flatMap((cycle) => cycle.attempts), ...record.attempts]
			.filter((attempt) => attempt.operationId === operationId)
			.map(() => ({ version: record.version + 1, workId: record.workId })),
	);
});
