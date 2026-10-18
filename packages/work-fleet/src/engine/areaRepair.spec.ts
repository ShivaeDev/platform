import { Effect } from "effect";
import { expect } from "vitest";
import { conflictingPr } from "#engine/deliveryFailure.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test", "isolated");

for (const released of [false, true]) {
	test(`conflict repair ${released ? "regains" : "keeps"} its area ahead of a prepared provider retry across restart`, () => {
		let now = 100;
		let reject = false;
		let conflicting = false;
		return withEngine(
			{
				areaMergeWaitMs: released ? 5000 : 100_000,
				deliveryQuery: () => (conflicting ? Effect.fail(conflictingPr("main-revision")) : Effect.succeed(undefined)),
				now: () => now,
				submissionFailure: () =>
					reject ? new SessionFailure({ code: "session-queue-full", message: "Provider queue is full", reason: "rejected" }) : undefined,
			},
			(fixture) =>
				Effect.gen(function* () {
					fixture.areas("one", ["fleet/host"]);
					fixture.areas("two", [released ? "fleet/host" : "board/ui"]);
					yield* prepareWork("one");
					yield* prepareWork("two");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					finishWorkers(fixture);
					const ready = (yield* fleet.reconcile("one")).value;
					expect(ready).toMatchObject({ mergeReadyAt: 100, stage: "needs-human" });
					if (released) {
						now += 5000;
					}
					reject = true;
					yield* cycle;
					expect((yield* fleet.get("two")).value).toMatchObject({
						attempts: [{ status: "failed" }],
						stage: "prepared",
					});
					expect((yield* fleet.get("one")).value.mergeAreasReleased).toBe(released ? true : undefined);
					reject = false;
					if (!released) {
						fixture.areas("two", ["fleet/host"]);
						now += 30_000;
						yield* fleet.dispatch("two").pipe(Effect.result);
						expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area fleet/host held by one");
					}
					conflicting = true;
					yield* fixture.restart(cycle);
					const repaired = (yield* fleet.get("one")).value;
					expect(repaired.stage).toBe("executing");
					expect(repaired.blocker).toBeUndefined();
					expect(repaired.mergeAreasReleased).toBeUndefined();
					expect(repaired.result).toEqual(ready.result);
					expect(repaired.attempts.at(-1)).toMatchObject({
						prompt: expect.stringContaining("Fetch and merge main"),
						receipt: { sessionId: ready.attempts[0]?.receipt?.sessionId },
						role: "repair",
					});
					now += 30_000;
					yield* fixture.restart(cycle);
					expect((yield* fleet.get("two")).value).toMatchObject({
						attempts: [{ status: "failed" }],
						blocker: "waiting for area fleet/host held by one",
						stage: "prepared",
					});
					expect((yield* fleet.get("one")).value.attempts.map((attempt) => attempt.operationId)).toEqual(
						repaired.attempts.map((attempt) => attempt.operationId),
					);
				}),
		);
	});
}
