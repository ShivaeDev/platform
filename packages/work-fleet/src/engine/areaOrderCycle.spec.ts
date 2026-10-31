import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { areaOrder, areaOrderChecks, cyclicChecks } from "#test/areaOrderStory.ts";
import { mergeOrderCycle } from "#test/mergeOrderCycle.ts";
import { MIGRATION_PATH } from "#test/predictionRepository.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

for (const green of [true, false]) {
	areaOrder.it(
		green
			? "a green area holder ordered behind a repair becomes ready first, merges and lets the repair rebase in its area"
			: "two red PRs lend the held area to the repair instead of reporting a wait cycle",
		[watchedBranches, areaOrderChecks],
		function* ({
			fleet,
			setAreas,
			preparePredictionWork,
			pushWorkerBranch,
			finishWorkers,
			advanceTime,
			conflictsWithMain,
			checksFail,
			checksPass,
			resolveMainConflict,
			restart,
			statusText,
			mergeWatchedPr,
			mergeWorkerMain,
			turnOutput,
		}) {
			setAreas("two", ["work-fleet"]);
			yield* preparePredictionWork("two");
			yield* fleet.dispatch("two");
			pushWorkerBranch("two", { [MIGRATION_PATH]: "export const migrations = { repair: true };\n" });
			finishWorkers();
			yield* fleet.reconcile("two");
			advanceTime(1001);
			yield* fleet.reconcile("two");
			setAreas("one", ["work-fleet"]);
			yield* preparePredictionWork("one");
			yield* fleet.dispatch("one");
			pushWorkerBranch("one", { [MIGRATION_PATH]: "export const migrations = { first: true };\n" });
			checksFail("two");
			conflictsWithMain("two");
			const blocked = yield* fleet.reconcile("two");
			expect(blocked.value).toMatchObject({ blocker: "waiting for area work-fleet held by one", step: "repairing" });
			if (!green) {
				checksFail("one");
			}
			finishWorkers();

			const holder = yield* fleet.reconcile("one");

			expect(yield* statusText()).not.toContain("Stuck: wait cycle");
			if (green) {
				expect(holder.value.decision?.code).toBe("reviewed-pr-ready");
				expect(holder.value.predictedConflictHold).toBeUndefined();
				yield* restart();
				const resumed = yield* fleet.reconcile("one");
				expect(resumed.value.predictedConflictHold).toBeUndefined();

				const waitingRepair = yield* fleet.reconcile("two");
				expect(waitingRepair.value.blocker).toBe("waiting for area work-fleet held by one");
				mergeWatchedPr("one");
				expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			} else {
				expect(holder.value.mergeAreasReleased).toBe(true);
				expect(holder.value.predictedConflictHold?.prs).toEqual(["https://github.com/example/project/pull/1"]);
			}
			const repair = yield* fleet.reconcile("two");
			expect(repair.value.step).toBe("working");
			expect(repair.value.attempts.at(-1)?.role).toBe("repair");
			expect(turnOutput(repair.value.attempts.at(-1)?.receipt)).toContain("Fetch and merge main");
			if (green) {
				mergeWorkerMain("two", { [MIGRATION_PATH]: "export const migrations = { first: true, repair: true };\n" });
				resolveMainConflict("two");
				checksPass("two");
				finishWorkers();
				expect((yield* fleet.reconcile("two")).value.decision?.code).toBe("reviewed-pr-ready");
			}
		},
	);
}

areaOrder.it(
	"the green PR drops its cycle wait when the other PR is red, including after restart",
	[mergeOrderCycle, cyclicChecks],
	function* ({ prepareWork, dispatch, checksFail, finishWorkers, reconcile, restart, statusText, get }) {
		for (const id of ["one", "two"]) {
			yield* prepareWork(id);
			yield* dispatch(id);
		}
		checksFail("one");
		finishWorkers();
		yield* reconcile("one");

		const ready = yield* reconcile("two");

		expect(ready.value.decision?.code).toBe("reviewed-pr-ready");
		yield* outcomes({
			"red PR's stored merge order": [
				get("one"),
				expect.objectContaining({
					value: expect.objectContaining({ predictedConflictHold: expect.objectContaining({ prs: ["https://example.invalid/pr/two"] }) }),
				}),
			],
			"status": [statusText(), expect.not.stringContaining("Stuck: wait cycle")],
		});
		yield* restart();
		expect((yield* reconcile("two")).value.predictedConflictHold).toBeUndefined();
	},
);
