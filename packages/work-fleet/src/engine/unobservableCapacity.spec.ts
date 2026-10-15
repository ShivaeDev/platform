import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure, type SessionObservation } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");
const reconcile = Fleet.pipe(Effect.flatMap((fleet) => fleet.reconcile("one")));

for (const role of ["worker", "reviewer"] as const) {
	test(`an invisible ${role} replacement retains its loss count through capacity rejection and restart`, () => {
		let now = 0;
		let hidden = false;
		let rejected = false;
		function visibility(observation: SessionObservation): SessionObservation {
			return hidden ? { ...observation, execution: "running", turnMissing: true } : observation;
		}
		return withEngine(
			{
				decorateTransport: (transport) => ({
					...transport,
					observe: (receipt) => transport.observe(receipt).pipe(Effect.map(visibility)),
				}),
				now: () => now,
				reviewRunning: true,
				submissionFailure: (call) =>
					rejected && call === "turn"
						? new SessionFailure({ capacity: "serverOverloaded", message: "Synthetic capacity rejection", reason: "rejected" })
						: undefined,
			},
			(fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					if (role === "reviewer") {
						finishWorkers(fixture);
						yield* fleet.reconcile("one");
					}
					const initial = (yield* fleet.get("one")).value;
					expect(initial.attempts.at(-1)?.role).toBe(role);
					hidden = true;
					yield* fleet.reconcile("one");
					rejected = true;
					now += 5 * 60_000;
					const queued = yield* fixture.restart(reconcile);
					expect(queued.value.launchRetry).toEqual({ rejectedAt: now, rejections: 1, retryAt: now + 30_000 });
					expect(queued.value.attempts.at(-1)).toMatchObject({ observationRetries: 1, role, status: "failed" });
					expect(fixture.decisions).toHaveLength(0);
					rejected = false;
					now += 30_000;
					yield* fixture.restart(cycle);
					const replacement = yield* fixture.restart(reconcile);
					expect(replacement.value.launchRetry).toBeUndefined();
					expect(replacement.value.attempts.at(-1)?.receipt).toBeDefined();
					expect(replacement.value.decision).toBeUndefined();
					now += 5 * 60_000;
					const lost = yield* fixture.restart(reconcile);
					expect(lost.value).toMatchObject({
						decision: { code: "session-turn-missing", reason: expect.stringContaining("one automatic resume") },
						stage: "needs-human",
					});
					expect(lost.value.attempts).toHaveLength(initial.attempts.length + 2);
					expect(fixture.settings.filter((setting) => setting.call === "turn")).toHaveLength(initial.attempts.length + 2);
					expect(fixture.decisions).toHaveLength(1);
				}),
		);
	});
}
