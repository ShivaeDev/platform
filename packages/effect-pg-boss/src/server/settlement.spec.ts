import { setImmediate } from "node:timers/promises";
import { Effect, Layer, Schema } from "effect";
import { expect, it, vi } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { makePgBoss } from "#service.ts";
import { constructorOptions, FakeClient, job } from "#test/fake-client.ts";
import { scriptedClient } from "#test/scriptedClient.ts";

it.each(["failure", "defect"] as const)("settles scheduled jobs separately after a %s", async (outcome) => {
	const client = new FakeClient();
	const Schedule = defineSchedule({ cron: "0 * * * *", name: "settle-schedule" });
	const Jobs = makePgBoss("@test/SettleSchedule");
	const failure = new Error("scheduled poison job");
	let handled = 0;
	const failed = outcome === "failure" ? Effect.fail(failure) : Effect.die(failure);
	const worker = Schedule.run(
		Effect.suspend(() => {
			handled += 1;
			return handled === 2 ? failed : Effect.void;
		}),
	);
	const jobs = Array.from({ length: 10 }, (_, id) => ({ ...job(Schedule.name, null), id: String(id) }));
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				yield* Jobs;
				yield* Effect.promise(() => client.workers[0]?.run(jobs) ?? Promise.resolve());
			}).pipe(Effect.provide(Jobs.layer({ ...constructorOptions, clientFactory: () => client, jobs: [worker] }))),
		),
	);
	expect(handled).toBe(10);
	expect(client.completeCalls.map(({ job: completed }) => completed)).toEqual(jobs.filter((entry) => entry.id !== "1"));
	expect(client.failCalls).toEqual([{ error: failure, job: jobs[1], name: Schedule.name }]);
});

it.each(["self interruption", "aborted signal"] as const)("leaves interrupted and remaining jobs to pg-boss expiry after %s", async (outcome) => {
	const client = new FakeClient();
	const Queue = defineQueue({ name: "interrupted", schema: Schema.Struct({ id: Schema.Number }) });
	const Jobs = makePgBoss("@test/InterruptedSettlement");
	const controller = new AbortController();
	const started = Promise.withResolvers<void>();
	const handled: number[] = [];
	const worker = Queue.handle(({ id }) =>
		Effect.suspend(() => {
			handled.push(id);
			if (id !== 1) {
				return Effect.void;
			}
			started.resolve();
			return outcome === "self interruption" ? Effect.interrupt : Effect.never;
		}),
	);
	const jobs = Array.from({ length: 3 }, (_, id) => ({ ...job(Queue.name, { id }), id: String(id), signal: controller.signal }));
	const returned = vi.fn();
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				yield* Jobs;
				client.workers[0]?.run(jobs).then(returned, returned);
				yield* Effect.promise(() => started.promise);
				if (outcome === "aborted signal") {
					controller.abort();
				}
				yield* Effect.promise(setImmediate);
				expect(handled).toEqual([0, 1]);
				expect(client.completeCalls).toEqual([{ job: jobs[0], name: Queue.name }]);
				expect(client.failCalls).toEqual([]);
				expect(returned).not.toHaveBeenCalled();
			}).pipe(Effect.provide(Jobs.layer({ ...constructorOptions, clientFactory: () => client, jobs: [worker] }))),
		),
	);
});

it("allows producer clients without settlement capabilities and fails worker registration with a typed error", async () => {
	const { complete, fail, ...client } = scriptedClient({
		createQueue: async () => undefined,
		getQueue: async () => null,
		off: () => undefined,
		on: () => undefined,
		start: async () => undefined,
		stop: async () => undefined,
	});
	expect(complete).toBeDefined();
	expect(fail).toBeDefined();
	const Queue = defineQueue({ name: "custom-settlement", schema: Schema.Struct({}) });
	const Jobs = makePgBoss("@test/CustomSettlement");
	await Effect.runPromise(Effect.scoped(Layer.build(Jobs.layer({ ...constructorOptions, clientFactory: () => client, jobs: [Queue] }))));
	await expect(
		Effect.runPromise(
			Effect.scoped(Layer.build(Jobs.layer({ ...constructorOptions, clientFactory: () => client, jobs: [Queue.handle(() => Effect.void)] }))),
		),
	).rejects.toMatchObject({ _tag: "PgBossError", operation: "register" });
});
