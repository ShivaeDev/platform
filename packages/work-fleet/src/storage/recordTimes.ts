import { Clock, Effect, Schema } from "effect";

export const recordTimeColumns = { completedAt: "number", stageEnteredAt: "number", updatedAt: "number" } as const;

export function recordTimes(record: Readonly<Record<string, unknown>>, previous: Readonly<Record<string, unknown>> | undefined, now: number) {
	const sameStage = previous !== undefined && previous.stage === record.stage;
	const enteredAt = sameStage ? previous.stageEnteredAt : now;
	let completedAt: unknown;
	if (record.stage === "completed") {
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
	const timed = recordTimes(encoded, prior, yield* Clock.currentTimeMillis);
	const value = yield* Schema.decodeUnknownEffect(schema)(timed);
	return { encoded: timed, value };
});
