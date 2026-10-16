import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test", "isolated");
const missing = new SessionFailure({
	code: "session-turn-missing",
	message: "No matching accepted turn is observable; absence does not authorize replay",
	reason: "ambiguous",
});
const unavailable = new SessionFailure({ code: "session-unavailable", message: "Provider read unavailable", reason: "ambiguous" });

for (const readFailures of [false, true]) {
	test(`an unobservable submitted review restarts on a new thread without a recovery request: read failures=${readFailures}`, () => {
		let now = 100;
		let operationId: string | undefined;
		let reads = 0;
		return withEngine(
			{
				decorateTransport: (transport) => ({
					...transport,
					reconcile: (input) => {
						if (input.operationId !== operationId) {
							return transport.reconcile(input);
						}
						reads += 1;
						return Effect.fail(readFailures && reads < 4 ? unavailable : missing);
					},
					startTurn: (input) => {
						if (input.access !== "read-only" || operationId !== undefined) {
							return transport.startTurn(input);
						}
						operationId = input.operationId;
						return Effect.fail(readFailures ? unavailable : missing);
					},
				}),
				denyDelivery: true,
				now: () => now,
			},
			(fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					finishWorkers(fixture);
					const submitted = (yield* fleet.reconcile("one")).value;
					const original = submitted.attempts.at(-1);
					expect(original).toMatchObject({ reviewHead: submitted.result?.head, role: "reviewer" });
					expect(original?.sessionId).toBeDefined();
					expect(original?.receipt).toBeUndefined();
					if (readFailures) {
						for (const delay of [30_000, 60_000, 120_000, 240_000]) {
							now += delay;
							yield* fixture.restart(cycle);
						}
					}
					const queued = (yield* fleet.get("one")).value;
					expect(queued.stage).toBe("reviewing");
					expect(queued.decision).toBeUndefined();
					expect(queued.attempts.at(-1)).toMatchObject({ operationId, sessionUnusable: true, status: "failed" });
					expect(queued.attempts.at(-1)?.readRetry).toBeUndefined();
					expect(queued.launchRetry).toMatchObject({ rejections: 1, retryAt: now + 30_000 });
					expect(fixture.decisions).toHaveLength(0);
					now += 30_000;
					yield* fixture.restart(cycle);
					const ready = (yield* fleet.get("one")).value;
					expect(ready.decision?.code).toBe("reviewed-pr-ready");
					expect(ready.result).toEqual(submitted.result);
					expect(ready.review).toMatchObject({ head: submitted.result?.head, verdict: "approved" });
					expect(ready.checks).toMatchObject({ head: submitted.result?.head, passed: true });
					expect(ready.attempts.at(-1)?.receipt?.sessionId).not.toBe(original?.sessionId);
					expect(fixture.starts.at(-1)?.access).toBe("read-only");
					expect(fixture.starts).toHaveLength(3);
					expect(fixture.decisions).toHaveLength(1);
				}),
		);
	});
}

test("missing review turns share the five-attempt budget with provider capacity failures", () => {
	let now = 100;
	let reviews = 0;
	return withEngine(
		{
			decorateTransport: (transport) => ({
				...transport,
				startTurn: (input) => {
					if (input.access !== "read-only") {
						return transport.startTurn(input);
					}
					reviews += 1;
					return Effect.fail(
						reviews < 5 ? missing : new SessionFailure({ capacity: "serverOverloaded", message: "Provider at capacity", reason: "rejected" }),
					);
				},
			}),
			now: () => now,
		},
		(fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				for (const [index, delay] of [30_000, 60_000, 120_000, 240_000].entries()) {
					expect((yield* fleet.get("one")).value.launchRetry?.rejections).toBe(index + 1);
					expect(fixture.decisions).toHaveLength(0);
					now += delay;
					yield* fixture.restart(cycle);
				}
				const exhausted = (yield* fleet.get("one")).value;
				expect(exhausted.stage).toBe("needs-human");
				expect(exhausted.decision?.reason).toContain("Provider at capacity; provider failure after 5 attempts");
				expect(exhausted.launchRetry).toBeUndefined();
				expect(fixture.starts).toHaveLength(6);
				expect(fixture.decisions).toHaveLength(1);
			}),
	);
});
