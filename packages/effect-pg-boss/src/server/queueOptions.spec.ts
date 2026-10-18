import { Effect, Redacted, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { boss } from "#test/boss.ts";
import { queueResult } from "#test/queueResult.ts";

boss.it("reconciles schedules, preserves unspecified settings and avoids unchanged updates", [], function* ({ boot, client }) {
	const Initial = defineSchedule({ cron: "0 * * * *", name: "cleanup", queue: { expireInSeconds: 15, notify: true } });
	const Changed = defineSchedule({ cron: "0 * * * *", name: "cleanup", queue: { notify: false, retryBackoff: false, retryLimit: 0 } });
	const options = { clientCacheKey: Symbol("schedules") };
	yield* boot([Initial.run(Effect.void)], options);
	yield* boot([Initial.run(Effect.void)], options);
	expect(client.updateQueueCalls).toEqual([]);
	yield* boot([Changed.run(Effect.void)], options);
	expect(client.updateQueueCalls).toEqual([
		{ name: "cleanup", options: { deadLetter: "cleanup-dlq", notify: false, retryBackoff: false, retryLimit: 0 } },
	]);
	expect(client.queues.get("cleanup")).toMatchObject({ expireInSeconds: 15, notify: false, retryBackoff: false, retryLimit: 0 });
});

boss.it("releases the acquired client and application error callback when immutable queue options conflict", [], function* ({ boot, client }) {
	client.queues.set("immutable", queueResult("immutable", { partition: false, policy: "standard" }));
	const Queue = defineQueue({ key: () => "entity", name: "immutable", queue: { partition: true, policy: "singleton" }, schema: Schema.Struct({}) });
	const reported: Error[] = [];
	const error = yield* Effect.flip(boot([Queue.handle(() => Effect.void)], { onError: (failure) => Effect.sync(() => reported.push(failure)) }));
	expect(error).toMatchObject({ _tag: "PgBossQueueOptionsError", options: ["partition", "policy"], queue: "immutable" });
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

boss.it("creates a queue again after PostgreSQL rolls its creation back as a deadlock victim", [], function* ({ boot, client }) {
	client.createQueueFailures.push(deadlock(), deadlock());
	const Queue = defineQueue({ name: "contended", queue: { partition: true }, schema: Schema.Struct({}) });
	yield* boot([Queue]);
	expect(client.createQueueCalls.map(({ name }) => name)).toEqual(["contended-dlq", "contended"]);
	expect(client.queues.get("contended")).toMatchObject({ partition: true });
});

boss.it("fails registration at once on a non-deadlock error, and after repeated deadlocks", [], function* ({ boot, client }) {
	const unique = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
	const Queue = defineQueue({ name: "contended", schema: Schema.Struct({}) });
	for (const failures of [[unique], Array.from({ length: 6 }, deadlock)]) {
		client.createQueueFailures.splice(0, client.createQueueFailures.length, ...failures, deadlock());
		const error = yield* Effect.flip(boot([Queue]));
		expect(error).toMatchObject({ _tag: "PgBossError", operation: "register" });
		expect(error._tag === "PgBossError" && Redacted.value(error.original)).toBe(failures.at(-1));
		expect(client.createQueueFailures).toHaveLength(1);
		expect(client.createQueueCalls).toEqual([]);
	}
});
