import { Effect, Schema } from "effect";
import { expect, it } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { makePgBoss } from "#service.ts";
import { constructorOptions, FakeClient } from "#test/fakeClient.ts";

it("passes native burst defaults and explicit queue and schedule work options to pg-boss", async () => {
	const client = new FakeClient();
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
	const Jobs = makePgBoss("@test/WorkerOptions");
	await Effect.runPromise(
		Effect.scoped(
			Effect.asVoid(Jobs).pipe(
				Effect.provide(
					Jobs.layer({
						...constructorOptions,
						clientFactory: () => client,
						jobs: [Default.handle(() => Effect.void), Custom.handle(() => Effect.void), Schedule.run(Effect.void)],
					}),
				),
			),
		),
	);
	expect(client.workers.map(({ options }) => options)).toEqual([
		{ batchSize: 10, burstWhenBatchFull: true, includeMetadata: true },
		{ ...worker, includeMetadata: true },
		{ ...worker, includeMetadata: true },
	]);
	expect(defineSchedule({ cron: "0 * * * *", name: "default-schedule" }).workerOptions).toEqual({ batchSize: 10, burstWhenBatchFull: true });
});
