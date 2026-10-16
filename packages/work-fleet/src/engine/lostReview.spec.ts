import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { SessionFailure, type StartSession } from "#session/schema.ts";
import { type EngineFixture, finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test", "isolated");
const native = codexAdapter(() => Effect.die("A lost thread has no provider lookup"), {
	beforeTurn: () => Effect.succeed({}),
	provisioning: "unknown",
	threadStart: () => ({}),
});

for (const exhausted of [false, true]) {
	test(`lost review acknowledgement restarts within the shared provider budget: exhausted=${exhausted}`, () => {
		let now = 100;
		let losses = exhausted ? 4 : 1;
		let reads = 0;
		const retries = losses;
		function loseThread(input: StartSession, sessionId: string) {
			if (input.access !== "read-only") {
				return Effect.succeed(sessionId);
			}
			losses -= 1;
			if (losses < 0) {
				return Effect.succeed(sessionId);
			}
			reads += 1;
			return native.reconcile({ operationId: input.operationId }).pipe(
				Effect.mapError((error) => new SessionFailure({ code: "session-unavailable", message: error.message, reason: error.reason })),
				Effect.flatMap(() => Effect.die("A lost thread cannot be reconciled")),
			);
		}
		const verify = Effect.fnUntraced(function* (fixture: EngineFixture) {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			const result = (yield* fleet.get("one")).value.result;
			for (let failure = 1; failure <= retries; failure += 1) {
				for (const delay of [30_000, 60_000, 120_000, 240_000]) {
					now += delay;
					yield* fixture.restart(cycle);
				}
				const queued = (yield* fleet.get("one")).value;
				expect(reads).toBe(failure * 5);
				expect(queued.stage).toBe("reviewing");
				expect(queued.decision).toBeUndefined();
				expect(queued.attempts.at(-1)).toMatchObject({ role: "reviewer", sessionUnusable: true, status: "failed" });
				expect(queued.attempts.at(-1)?.readRetry).toBeUndefined();
				expect(queued.launchRetry).toMatchObject({ rejections: failure, retryAt: now + 30_000 * 2 ** (failure - 1) });
				expect(fixture.decisions).toHaveLength(0);
				expect(
					(yield* fixture
						.acknowledgeTurn(queued.attempts.at(-1)?.operationId ?? "missing", { sessionId: "late", turnId: "late" })
						.pipe(Effect.result))._tag,
				).toBe("Failure");
				now += 30_000 * 2 ** (failure - 1);
				yield* fixture.restart(cycle);
			}
			const final = (yield* fleet.get("one")).value;
			if (exhausted) {
				expect(final.decision?.reason).toContain("provider failure after 5 attempts");
				expect(final.launchRetry).toBeUndefined();
				expect(fixture.launched).toHaveLength(6);
			} else {
				expect(final.decision?.code).toBe("reviewed-pr-ready");
				expect(final.result).toEqual(result);
				expect(final.review?.head).toBe(result?.head);
				expect(final.checks).toMatchObject({ head: result?.head, passed: true });
				expect(final.attempts.at(-1)?.receipt?.sessionId).toBe(`session-${fixture.starts.at(-1)?.operationId}`);
				expect(final.attempts.at(-1)?.receipt?.sessionId).not.toBe(`session-${fixture.starts[1]?.operationId}`);
				expect(fixture.starts.at(-1)?.access).toBe("read-only");
				expect(fixture.decisions).toHaveLength(1);
			}
		});
		return withEngine(
			{
				decorateTransport: (transport) => ({
					...transport,
					reconcile: (input) => {
						reads += 1;
						return native.reconcile(input);
					},
					startSession: (input) => transport.startSession(input).pipe(Effect.flatMap((sessionId) => loseThread(input, sessionId))),
				}),
				denyDelivery: true,
				now: () => now,
				submissionFailure: (call) =>
					call === "turn" && losses < 0 && exhausted
						? new SessionFailure({ capacity: "serverOverloaded", message: "Provider at capacity", reason: "rejected" })
						: undefined,
			},
			verify,
		);
	});
}
