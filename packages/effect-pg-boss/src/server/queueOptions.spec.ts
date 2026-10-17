import { Context, Effect, Layer, Schema } from "effect";
import { expect, it } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { registerJobs } from "#internal/register.ts";
import { makePgBoss } from "#service.ts";
import { constructorOptions, FakeClient, queueResult } from "#test/fake-client.ts";

it("reconciles schedules, preserves unspecified settings and avoids unchanged updates", async () => {
	const client = new FakeClient();
	const Initial = defineSchedule({ cron: "0 * * * *", name: "cleanup", queue: { expireInSeconds: 15, notify: true } });
	const Changed = defineSchedule({ cron: "0 * * * *", name: "cleanup", queue: { notify: false, retryBackoff: false, retryLimit: 0 } });
	await Effect.runPromise(registerJobs(client, [Initial.run(Effect.void)], Context.empty(), false));
	await Effect.runPromise(registerJobs(client, [Initial.run(Effect.void)], Context.empty(), true));
	expect(client.updateQueueCalls).toEqual([]);
	await Effect.runPromise(registerJobs(client, [Changed.run(Effect.void)], Context.empty(), true));
	expect(client.updateQueueCalls).toEqual([
		{ name: "cleanup", options: { deadLetter: "cleanup-dlq", notify: false, retryBackoff: false, retryLimit: 0 } },
	]);
	expect(client.queues.get("cleanup")).toMatchObject({ expireInSeconds: 15, notify: false, retryBackoff: false, retryLimit: 0 });
});

it("releases the acquired client and listener when immutable queue options conflict", async () => {
	const client = new FakeClient();
	client.queues.set("immutable", queueResult("immutable", { partition: false, policy: "standard" }));
	const Queue = defineQueue({ name: "immutable", queue: { partition: true, policy: "singleton" }, schema: Schema.Struct({}) });
	const Jobs = makePgBoss("@test/ImmutableOptions");
	await expect(
		Effect.runPromise(
			Effect.scoped(
				Layer.build(
					Jobs.layer({
						...constructorOptions,
						clientFactory: () => client,
						jobs: [Queue.handle(() => Effect.void)],
					}),
				),
			),
		),
	).rejects.toMatchObject({ _tag: "PgBossQueueOptionsError", options: ["partition", "policy"], queue: "immutable" });
	expect(client.workers).toEqual([]);
	expect(client.updateQueueCalls).toEqual([]);
	expect(client.stopCalls).toBe(1);
	expect(client.errors).toEqual([]);
});
