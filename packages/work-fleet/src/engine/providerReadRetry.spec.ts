import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test", "isolated");
const READ_FAILURE = new SessionFailure({ capacity: "serverOverloaded", message: "Capacity unavailable for thread/turns/list", reason: "rejected" });

for (const lostAcknowledgement of [true, false]) {
	test(`capacity read failure preserves its operation across restart: lost acknowledgement=${lostAcknowledgement}`, () => {
		let now = 100;
		let fail = true;
		let reads = 0;
		return withEngine(
			{
				concurrency: 1,
				decorateTransport: (transport) => ({
					...transport,
					observe: (receipt) => {
						reads += 1;
						return fail ? Effect.fail(READ_FAILURE) : transport.observe(receipt);
					},
					reconcile: (input) => {
						reads += 1;
						return fail ? Effect.fail(READ_FAILURE) : transport.reconcile(input);
					},
				}),
				lostAcknowledgement,
				now: () => now,
			},
			(fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					yield* prepareWork("two");
					yield* fleet.dispatch("one");
					if (!lostAcknowledgement) {
						fail = false;
						yield* fleet.reconcile("one");
						fail = true;
					}
					const before = (yield* fleet.get("one")).value;
					const queued = (yield* fleet.reconcile("one")).value;
					expect(queued.stage).toBe("executing");
					expect(queued.decision).toBeUndefined();
					expect(queued.launchRetry).toBeUndefined();
					expect(queued.attentionOwner).toBe("automation");
					expect(queued.attempts.at(-1)).toMatchObject({ ...before.attempts[0], readRetry: { failures: 1, retryAt: 30_100 } });
					expect(executing(queued)).toBe(true);
					expect(yield* fleet.dispatch("two").pipe(Effect.flip)).toMatchObject({ _tag: "StorageCapacity", kind: "execution" });
					const failedReads = reads;
					now = 30_099;
					yield* fixture.restart(cycle);
					expect(reads).toBe(failedReads);
					expect((yield* fleet.get("one")).value.attempts).toEqual(queued.attempts);
					now = 30_100;
					yield* fixture.restart(cycle);
					const retrying = (yield* fleet.get("one")).value;
					expect(retrying.attempts.at(-1)?.readRetry).toMatchObject({ failures: 2, retryAt: 90_100 });
					expect(fixture.launched).toHaveLength(1);
					fail = false;
					now = 90_100;
					yield* fixture.restart(cycle);
					const recovered = (yield* fleet.get("one")).value;
					expect(recovered.stage).toBe("executing");
					expect(recovered.attempts).toHaveLength(1);
					expect(recovered.attempts[0]?.operationId).toBe(before.attempts[0]?.operationId);
					expect(recovered.attempts[0]?.receipt).toEqual(fixture.operations.get(before.attempts[0]?.operationId ?? "missing"));
					expect(recovered.attempts[0]?.readRetry).toBeUndefined();
					expect(recovered.blocker).toBeUndefined();
					expect(recovered.attentionOwner).toBeUndefined();
					expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(1);
					finishWorkers(fixture);
					expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
					expect(fixture.launched).toHaveLength(2);
					expect(fixture.decisions).toHaveLength(0);
				}),
		);
	});
}
