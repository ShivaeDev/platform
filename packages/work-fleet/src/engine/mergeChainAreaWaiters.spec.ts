import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { checkRun } from "#test/githubChecks.ts";
import { MIGRATION_PATH } from "#test/predictionRepository.ts";
import { watchedBranches } from "#test/watchedBranches.ts";
import { watchedChecks } from "#test/watchedChecks.ts";

for (const [launchPriority, blockedElsewhere] of [
	["high", false],
	["urgent", false],
	["high", true],
	["urgent", true],
] as const) {
	isolatedEngine.it(
		`a new ${launchPriority} launch competes with a requested CI repair that two open PRs await${blockedElsewhere ? " while another area stays occupied" : ""}`,
		[watchedBranches, watchedChecks],
		function* (fleet) {
			fleet.setPriority("one", "high");
			for (const id of ["one", "two", "three"]) {
				fleet.approveWork(id, `board-${id}`);
				fleet.setAreas(id, id === "one" && blockedElsewhere ? ["shared", "other"] : ["shared"]);
				yield* fleet.preparePredictionWork(id);
				yield* fleet.dispatch(id);
				fleet.pushWorkerBranch(id, { [MIGRATION_PATH]: `export const migrations = { ${id}: ${id} };\n` });
				const pr = fleet.publishedPredictionResult(id);
				fleet.checksRespond(pr.head, [[checkRun({ headSha: pr.head, name: "verify" })]]);
				fleet.finishWorkers();
				const observed = (yield* fleet.reconcile(id)).value;
				if (id === "one") {
					expect(observed.decision?.code).toBe("reviewed-pr-ready");
					fleet.advanceTime(1001);
				} else {
					expect(observed.blocker).toContain(`waiting for ${fleet.publishedPredictionResult("one").pr} to merge`);
				}
			}
			yield* fleet.reconcile("one");
			yield* fleet.reserveForeign("holder", ["shared"]);
			const first = fleet.publishedPredictionResult("one");
			fleet.checksRespond(first.head, [[checkRun({ conclusion: "failure", headSha: first.head, name: "verify" })]]);
			const decision = (yield* fleet.get("one")).value.decision?.id ?? "missing";
			yield* fleet.resolve("one", decision, fleet.respond(decision, "retry", "answer", "Fix the failed required verify check on this PR."));
			yield* fleet.reconcile("one");
			fleet.finishWorkers();
			expect((yield* fleet.reconcile("one")).value).toMatchObject({ blocker: "waiting for area shared held by holder", step: "repairing" });
			fleet.advanceTime(100);
			fleet.approveWork("four", "board-four");
			fleet.setAreas("four", ["shared"]);
			fleet.setPriority("four", launchPriority);
			yield* fleet.preparePredictionWork("four");
			if (blockedElsewhere) {
				yield* fleet.reserveForeign("other-holder", ["other"]);
			}
			yield* fleet.restart();
			yield* fleet.vacateExecution("holder");
			if (launchPriority === "urgent") {
				expect((yield* fleet.dispatch("four")).value.step).toBe("working");
			} else {
				expect(yield* fleet.attemptDispatch("four")).toMatchObject({ message: "waiting for area shared queued ahead by one" });
				if (blockedElsewhere) {
					expect((yield* fleet.reconcile("one")).value.blocker).toBe("waiting for area other held by other-holder");
					yield* fleet.vacateExecution("other-holder");
				}
				const repairing = (yield* fleet.reconcile("one")).value;
				expect(repairing).toMatchObject({
					attempts: expect.arrayContaining([
						expect.objectContaining({ prompt: expect.stringContaining("Fix the failed required verify check"), role: "repair" }),
					]),
					step: "working",
				});
			}
		},
	);
}
