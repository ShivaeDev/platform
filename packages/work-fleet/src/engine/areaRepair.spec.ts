import { Effect } from "effect";
import { expect } from "vitest";
import { conflictRepairCanRaceDispatch } from "#test/engineAreaTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";

for (const released of [false, true]) {
	{
		const setup = conflictRepairCanRaceDispatch(released);
		isolatedEngine.it(
			`conflict repair ${released ? "regains" : "keeps"} its area ahead of a prepared provider retry across restart`,
			[setup],
			function* ({
				fleet,
				prepareWork,
				finishWorkers,
				restart,
				schedule,
				setAreas,
				advanceTime,
				rejectProvider,
				recoverProvider,
				conflictPullRequest,
			}) {
				setAreas("one", ["fleet/host"]);
				setAreas("two", [released ? "fleet/host" : "board/ui"]);
				yield* prepareWork("one");
				yield* prepareWork("two");
				yield* fleet.dispatch("one");
				finishWorkers();
				const ready = (yield* fleet.reconcile("one")).value;
				expect(ready).toMatchObject({ mergeReadyAt: 100, stage: "needs-human" });
				if (released) {
					advanceTime(5000);
				}
				rejectProvider();
				yield* schedule();
				expect((yield* fleet.get("two")).value).toMatchObject({
					attempts: [{ status: "failed" }],
					stage: "prepared",
				});
				expect((yield* fleet.get("one")).value.mergeAreasReleased).toBe(released ? true : undefined);
				recoverProvider();
				if (!released) {
					setAreas("two", ["fleet/host"]);
					advanceTime(30_000);
					yield* fleet.dispatch("two").pipe(Effect.result);
					expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area fleet/host held by one");
				}
				conflictPullRequest();
				yield* restart();
				yield* schedule();
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
				advanceTime(30_000);
				yield* restart();
				yield* schedule();
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
