import { Context, Effect, Option, Schema } from "effect";
import { expect, vi } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { PgBossPayloadError } from "#error.ts";
import { deadLetterQueueName } from "#health.ts";
import { boss } from "#test/boss.ts";
import { job } from "#test/fakeClient.ts";
import { queueResult } from "#test/queueResult.ts";

class Prefix extends Context.Service<Prefix, string>()("@test/Prefix") {}

boss.it("registers typed queues and UTC schedules with retries and dead letters", [], function* ({ boot, client, dispatch }) {
	const handled: string[] = [];
	const Emails = defineQueue({ name: "emails", queue: { retryLimit: 5 }, schema: Schema.Struct({ id: Schema.NumberFromString }) });
	const Cleanup = defineSchedule({ cron: "17 3 * * *", name: "cleanup" });
	const runtime = yield* boot([
		Emails.handle((payload, jobContext) => Effect.map(Prefix, (prefix) => handled.push(`${prefix}:${payload.id}:${jobContext.id}`))),
		Cleanup.run(Effect.map(Prefix, (prefix) => handled.push(prefix))),
	]).pipe(Effect.provideService(Prefix, "captured"));
	expect(Option.getOrUndefined(yield* runtime.jobs.enqueue(Emails, { id: 42 }))).toBe("job-id");
	expect(client.sendCalls).toEqual([{ data: { id: "42" }, name: "emails", options: undefined }]);
	yield* dispatch("emails", [job("emails", { id: "7" })]);
	yield* dispatch("cleanup", [job("cleanup", null)]);
	expect(handled).toEqual(["captured:7:job-emails", "captured"]);
	yield* runtime.stop;
	expect(client.startCalls).toBe(1);
	expect(client.stopCalls).toBe(1);
	expect(client.createQueueCalls).toEqual([
		{ name: deadLetterQueueName("emails"), options: undefined },
		{ name: "emails", options: { deadLetter: deadLetterQueueName("emails"), retryBackoff: true, retryLimit: 5 } },
		{ name: deadLetterQueueName("cleanup"), options: undefined },
		{ name: "cleanup", options: { deadLetter: deadLetterQueueName("cleanup"), retryBackoff: true, retryLimit: 3 } },
	]);
	expect(client.scheduleCalls).toEqual([{ cron: "17 3 * * *", data: null, name: "cleanup", options: { tz: "UTC" } }]);
});

boss.it("rejects malformed durable payloads before domain code runs", [], function* ({ boot, client, dispatch }) {
	const handler = vi.fn(() => Effect.void);
	const Queue = defineQueue({ name: "typed", schema: Schema.Struct({ count: Schema.Number }) });
	yield* boot([Queue.handle(handler)]);
	yield* dispatch("typed", [job("typed", { count: "wrong" })]);
	expect(client.failCalls[0]?.error).toBeInstanceOf(PgBossPayloadError);
	expect(handler).not.toHaveBeenCalled();
});

boss.it("projects queue and dead-letter health concurrently", [], function* ({ boot, client }) {
	const Queue = defineQueue({ name: "health", schema: Schema.Struct({}) });
	client.queues.set("health", queueResult("health", { activeCount: 2, failedCount: 3, queuedCount: 7, readyCount: 5 }));
	client.queues.set(deadLetterQueueName("health"), queueResult(deadLetterQueueName("health"), { queuedCount: 4 }));
	const { jobs } = yield* boot([Queue.handle(() => Effect.void)]);
	expect(yield* jobs.health).toMatchObject({ activeTotal: 2, deadLetteredTotal: 4, failedTotal: 3, queuedTotal: 7, readyTotal: 5 });
});
