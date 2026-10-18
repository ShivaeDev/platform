import { Context, Effect, Layer, Redacted, Schema } from "effect";
import { expect, it } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { registerJobs } from "#internal/register.ts";
import { makePgBoss } from "#service.ts";
import { constructorOptions, FakeClient } from "#test/fakeClient.ts";
import { queueResult } from "#test/queueResult.ts";

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

it("releases the acquired client and application error callback when immutable queue options conflict", async () => {
	const client = new FakeClient();
	client.queues.set("immutable", queueResult("immutable", { partition: false, policy: "standard" }));
	const Queue = defineQueue({ name: "immutable", queue: { partition: true, policy: "singleton" }, schema: Schema.Struct({}) });
	const Jobs = makePgBoss("@test/ImmutableOptions");
	const reported: Error[] = [];
	await expect(
		Effect.runPromise(
			Effect.scoped(
				Layer.build(
					Jobs.layer({
						...constructorOptions,
						clientFactory: () => client,
						jobs: [Queue.handle(() => Effect.void)],
						onError: (error) => Effect.sync(() => reported.push(error)),
					}),
				),
			),
		),
	).rejects.toMatchObject({ _tag: "PgBossQueueOptionsError", options: ["partition", "policy"], queue: "immutable" });
	expect(client.workers).toEqual([]);
	expect(client.updateQueueCalls).toEqual([]);
	expect(client.stopCalls).toBe(1);
	for (const listener of client.errors) {
		listener(Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" }));
	}
	expect(reported).toEqual([]);
});

function deadlock() {
	return Object.assign(new Error("deadlock detected"), { code: "40P01" });
}

it("creates a queue again after PostgreSQL rolls its creation back as a deadlock victim", async () => {
	const client = new FakeClient();
	client.createQueueFailures.push(deadlock(), deadlock());
	const Queue = defineQueue({ name: "contended", queue: { partition: true }, schema: Schema.Struct({}) });
	await Effect.runPromise(registerJobs(client, [Queue], Context.empty(), false));
	expect(client.createQueueCalls.map(({ name }) => name)).toEqual(["contended-dlq", "contended"]);
	expect(client.queues.get("contended")).toMatchObject({ partition: true });
});

it("fails registration at once on a queue creation error other than a deadlock, and after repeated deadlocks", async () => {
	const unique = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
	const Queue = defineQueue({ name: "contended", schema: Schema.Struct({}) });
	for (const failures of [[unique], Array.from({ length: 6 }, deadlock)]) {
		const client = new FakeClient();
		client.createQueueFailures.push(...failures, deadlock());
		const error = await Effect.runPromise(Effect.flip(registerJobs(client, [Queue], Context.empty(), false)));
		expect(error).toMatchObject({ _tag: "PgBossError", operation: "register" });
		expect(error._tag === "PgBossError" && Redacted.value(error.original)).toBe(failures.at(-1));
		expect(client.createQueueFailures).toHaveLength(1);
		expect(client.createQueueCalls).toEqual([]);
	}
});
