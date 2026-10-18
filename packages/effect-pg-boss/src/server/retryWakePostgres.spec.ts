import { Clock, Effect, Schema } from "effect";
import { expect, vi } from "vitest";
import { defineQueue } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt("retries a failed attempt when its backoff ends, before the polling backstop", [realPostgres], function* ({ boot, native, seed, until }) {
	const Queue = defineQueue({
		name: "retry-wake",
		queue: { retryBackoff: false, retryDelay: 1, retryLimit: 1 },
		schema: Schema.Struct({}),
		worker: { pollingIntervalSeconds: 5 },
	});
	const attempts: number[] = [];
	yield* seed(Queue, [{ data: {} }], native());
	yield* boot([
		Queue.handle(() =>
			Effect.gen(function* () {
				attempts.push(yield* Clock.currentTimeMillis);
				if (attempts.length === 1) {
					yield* Effect.fail(new Error("try again"));
				}
			}),
		),
	]);
	yield* until(
		Effect.sync(() => attempts.length),
		(count) => count === 2,
	);
	expect(attempts).toHaveLength(2);
	const elapsed = (attempts[1] ?? 0) - (attempts[0] ?? 0);
	expect(elapsed).toBeGreaterThanOrEqual(1000);
	expect(elapsed).toBeLessThan(1500);
});

postgresIt("cancels a pending retry wake when the worker Layer closes", [realPostgres], function* ({ boot, native, seed, untilJob }) {
	const Queue = defineQueue({
		name: "retry-wake-stop",
		queue: { retryBackoff: false, retryDelay: 1, retryLimit: 1 },
		schema: Schema.Struct({}),
		worker: { pollingIntervalSeconds: 5 },
	});
	const client = native();
	const wakes = vi.spyOn(client, "notifyWorker");
	const inventory = vi.spyOn(client, "getWipData");
	const [id] = yield* seed(Queue, [{ data: {} }], client);
	if (id === undefined) {
		throw new Error("The seeded job is missing");
	}
	const { jobs, stop } = yield* boot([Queue.handle(() => Effect.fail(new Error("try again")))], { clientFactory: () => client });
	yield* untilJob(jobs, Queue, id, "retry");
	yield* stop;
	const readsAtStop = inventory.mock.calls.length;
	yield* Effect.sleep("1200 millis");
	expect(inventory).toHaveBeenCalledTimes(readsAtStop);
	expect(wakes).not.toHaveBeenCalled();
});

postgresIt("wakes a retrying sibling while the first native worker remains busy", [realPostgres], function* ({ boot, native, until }) {
	const Queue = defineQueue({
		name: "retry-wake-sibling",
		queue: { notify: false, retryBackoff: false, retryDelay: 1, retryLimit: 1 },
		schema: Schema.Struct({ hold: Schema.Boolean }),
		worker: { batchSize: 1, localConcurrency: 2, pollingIntervalSeconds: 5 },
	});
	const client = native();
	const release = Promise.withResolvers<void>();
	const attempts: number[] = [];
	let holding = false;
	const held = Effect.sync(() => {
		holding = true;
	}).pipe(
		Effect.andThen(Effect.promise(() => release.promise)),
		Effect.ensuring(
			Effect.sync(() => {
				holding = false;
			}),
		),
	);
	const handler = Queue.handle(({ hold }) =>
		hold
			? held
			: Effect.gen(function* () {
					attempts.push(yield* Clock.currentTimeMillis);
					if (attempts.length === 1) {
						yield* Effect.fail(new Error("try again"));
					}
				}),
	);
	const { jobs } = yield* boot([handler], { clientFactory: () => client });
	yield* Effect.addFinalizer(() => Effect.sync(() => release.resolve()));
	const workers = yield* until(
		Effect.sync(() => client.getWipData().filter((worker) => worker.name === Queue.name)),
		(current) => current.length === 2 && current.every((worker) => worker.lastFetchedOn !== null && worker.count === 0),
	);
	const first = workers.find((worker) => worker.id === worker.workId);
	const sibling = workers.find((worker) => worker.id !== worker.workId);
	if (first === undefined || sibling === undefined) {
		throw new Error("The concurrent registration is missing its native workers");
	}
	yield* jobs.enqueue(Queue, { hold: true });
	client.notifyWorker(first.id);
	yield* until(
		Effect.sync(() => holding),
		(value) => value,
	);
	yield* jobs.enqueue(Queue, { hold: false });
	client.notifyWorker(sibling.id);
	yield* until(
		Effect.sync(() => attempts.length),
		(count) => count === 2,
	);
	expect(holding).toBe(true);
	expect(client.getWipData().find((worker) => worker.id === first.id)?.count).toBe(1);
	expect(attempts).toHaveLength(2);
	const elapsed = (attempts[1] ?? 0) - (attempts[0] ?? 0);
	expect(elapsed).toBeGreaterThanOrEqual(1000);
	expect(elapsed).toBeLessThan(1500);
	release.resolve();
});
