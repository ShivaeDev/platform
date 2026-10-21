import { Clock, Effect, Schema } from "effect";
import { fleetStage, StageInput } from "#stage.ts";

export const recordTimeColumns = { completedAt: "number", stageEnteredAt: "number", updatedAt: "number" } as const;

export function recordTimes(record: Readonly<Record<string, unknown>>, previous: Readonly<Record<string, unknown>> | undefined, now: number) {
	const sameStage = previous !== undefined && previous.stage === record.stage;
	const enteredAt = sameStage ? previous.stageEnteredAt : now;
	let completedAt: unknown;
	if (record.stage === "done") {
		completedAt = sameStage ? previous.completedAt : now;
	}
	return {
		...record,
		completedAt,
		stageEnteredAt: enteredAt,
		updatedAt: now,
	};
}

export const withRecordTimes = Effect.fn("FleetStore.withRecordTimes")(function* <
	TSchema extends Schema.Top & { readonly DecodingServices: never; readonly EncodingServices: never },
>(schema: TSchema, encoded: Readonly<Record<string, unknown>>, previous: TSchema["Type"] | undefined) {
	const decodeObject = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const prior = previous === undefined ? undefined : yield* decodeObject(yield* Schema.encodeEffect(schema)(previous));
	const step = typeof encoded.step === "string" ? encoded.step : undefined;
	const stage = step === undefined ? encoded.stage : fleetStage(yield* Schema.decodeUnknownEffect(StageInput)(encoded));
	const timed = { ...recordTimes({ ...encoded, stage }, prior, yield* Clock.currentTimeMillis), stage };
	const value = yield* Schema.decodeUnknownEffect(schema)(timed);
	return { encoded: timed, value };
});
