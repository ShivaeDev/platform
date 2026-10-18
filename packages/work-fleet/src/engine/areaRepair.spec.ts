import { Effect } from "effect";
import { expect } from "vitest";
import { cycle } from "#engine/scheduler.ts";
import { conflictRepairCanRaceDispatch } from "#test/conflictRepairCanRaceDispatch.ts";
import { isolatedEngine } from "#test/engineStory.ts";

for (const released of [false, true]) {
	{
		const setup = conflictRepairCanRaceDispatch(released);
		isolatedEngine.it(
			`conflict repair ${released ? "regains" : "keeps"} its area ahead of a prepared provider retry across restart`,
			[setup.given],
			function* ({ fixture, fleet, prepareWork, finishWorkers, restart, schedule }) {
				const context = setup.context();
				fixture.areas("one", ["fleet/host"]);
				fixture.areas("two", [released ? "fleet/host" : "board/ui"]);
				yield* prepareWork("one");
				yield* prepareWork("two");
				yield* fleet.dispatch("one");
				finishWorkers();
				const ready = (yield* fleet.reconcile("one")).value;
				expect(ready).toMatchObject({ mergeReadyAt: 100, stage: "needs-human" });
				if (released) {
					context.now += 5000;
				}
				context.reject = true;
				yield* schedule();
				expect((yield* fleet.get("two")).value).toMatchObject({
					attempts: [{ status: "failed" }],
					stage: "prepared",
				});
				expect((yield* fleet.get("one")).value.mergeAreasReleased).toBe(released ? true : undefined);
				context.reject = false;
				if (!released) {
					fixture.areas("two", ["fleet/host"]);
					context.now += 30_000;
					yield* fleet.dispatch("two").pipe(Effect.result);
					expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area fleet/host held by one");
				}
				context.conflicting = true;
				yield* restart(cycle);
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
				context.now += 30_000;
				yield* restart(cycle);
				expect((yield* fleet.get("two")).value).toMatchObject({
					attempts: [{ status: "failed" }],
					blocker: "waiting for area fleet/host held by one",
					stage: "prepared",
				});
				expect((yield* fleet.get("one")).value.attempts.map((attempt) => attempt.operationId)).toEqual(
					repaired.attempts.map((attempt) => attempt.operationId),
				);
			},
		);
	}
}
