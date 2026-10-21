import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { TIMEOUT, timeoutProvider } from "#test/timeoutProvider.ts";

const test = postgresTests("test");

for (const scenario of [
	{ landed: false, priorTurn: false },
	{ landed: false, priorTurn: true },
	{ landed: true, priorTurn: true },
]) {
	const { landed, priorTurn } = scenario;
	test(`timed-out submissions reconcile the saved operation with backoff: landed=${landed}, priorTurn=${priorTurn}`, () => {
		let now = 100;
		const { decorateTransport, state } = timeoutProvider(landed, priorTurn);
		return withEngine(
			{
				decorateTransport,
				denyDelivery: true,
				now: () => now,
			},
			(fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					const waiting = (yield* fleet.dispatch("one")).value;
					expect(waiting.step).toBe("working");
					expect(waiting.attempts[0]?.readRetry).toMatchObject({ failures: 1, retryAt: 30_100 });
					expect(waiting.decision).toBeUndefined();
					now = 30_099;
					yield* fixture.restart(fleet.reconcile("one"));
					expect(state.reads).toBe(0);
					now = 30_100;
					const retried = (yield* fixture.restart(fleet.reconcile("one"))).value;
					if (!landed) {
						expect(retried.attempts[0]?.readRetry).toMatchObject({ failures: 2, retryAt: 90_100 });
						expect(retried.decision).toBeUndefined();
						now = 90_100;
						yield* fixture.restart(fleet.reconcile("one"));
						expect(state.inputs).toEqual([state.inputs[0], state.inputs[0], state.inputs[0]]);
					}
					expect(state.submissions).toBe(landed ? 1 : 3);
					expect((yield* fleet.get("one")).value.attempts).toHaveLength(1);
					finishWorkers(fixture);
					const ready = (yield* fleet.reconcile("one")).value;
					expect(ready.decision?.code).toBe("reviewed-pr-ready");
					expect(ready.checks?.passed).toBe(true);
					expect(fixture.decisions).toHaveLength(1);
					expect(fixture.decisions[0]).toContain("Reviewed PR is ready to merge");
				}),
		);
	});
}

test("timeouts exhaust the shared provider read budget and retain ownership", () => {
	let now = 100;
	return withEngine(
		{
			decorateTransport: (transport) => ({
				...transport,
				reconcile: () => Effect.fail(new SessionFailure({ message: TIMEOUT, reason: "unavailable" })),
			}),
			now: () => now,
			submissionFailure: () => new SessionFailure({ message: TIMEOUT, reason: "unavailable" }),
		},
		(fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				for (const delay of [30_000, 60_000, 120_000, 240_000]) {
					now += delay;
					yield* fixture.restart(fleet.reconcile("one"));
				}
				const parked = (yield* fleet.get("one")).value;
				expect(parked.step).toBe("waiting");
				expect(parked.decision?.reason).toBe(
					`${TIMEOUT}; provider read failure after 5 attempts (4 automatic retries); execution ownership retained`,
				);
				expect(parked.attempts).toHaveLength(1);
				expect(parked.attempts[0]?.status).toBe("submitting");
				expect(fixture.decisions).toHaveLength(1);
			}),
	);
});
