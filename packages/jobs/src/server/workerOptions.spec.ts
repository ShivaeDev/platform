import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { boss } from "#test/boss.ts";

boss.it("passes native burst defaults and explicit queue and schedule work options to pg-boss", [], function* ({ boot, client }) {
	const Default = defineQueue({ name: "default", schema: Schema.Struct({}) });
	const worker = {
		batchSize: 4,
		burstWhenBatchFull: false,
		includeMetadata: false,
		localConcurrency: 3,
		notifyPollingIntervalSeconds: 15,
		pollingIntervalSeconds: 1,
	};
	const Custom = defineQueue({ name: "custom", schema: Schema.Struct({}), worker });
	const Schedule = defineSchedule({ cron: "0 * * * *", name: "scheduled", worker });
	yield* boot([Default.handle(() => Effect.void), Custom.handle(() => Effect.void), Schedule.run(Effect.void)]);
	expect(client.workers.map(({ options }) => options)).toEqual([
		{ batchSize: 10, burstWhenBatchFull: true, includeMetadata: true },
		{ ...worker, includeMetadata: true },
		{ ...worker, includeMetadata: true },
	]);
});
