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
	const [id] = yield* seed(Queue, [{ data: {} }], client);
	if (id === undefined) {
		throw new Error("The seeded job is missing");
	}
	const { jobs, stop } = yield* boot([Queue.handle(() => Effect.fail(new Error("try again")))], { clientFactory: () => client });
	yield* untilJob(jobs, Queue, id, "retry");
	yield* stop;
	yield* Effect.sleep("1200 millis");
	expect(wakes).not.toHaveBeenCalled();
});
