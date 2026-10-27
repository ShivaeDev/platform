import { Effect } from "effect";
import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { checkRun } from "#test/githubChecks.ts";
import { MIGRATION_PATH } from "#test/predictionRepository.ts";
import { watchedBranches } from "#test/watchedBranches.ts";
import { watchedChecks } from "#test/watchedChecks.ts";

for (const repair of ["checks", "answer"] as const) {
	isolatedEngine.it(
		`${repair} repair proceeds while two later PRs wait for its merge and reacquires its area across restart`,
		[watchedBranches, watchedChecks],
		function* ({
			fleet,
			preparePredictionWork,
			pushWorkerBranch,
			publishedPredictionResult,
			checksRespond,
			finishWorkers,
			setAreas,
			advanceTime,
			restart,
			respond,
			mergeWatchedPr,
			approveWork,
		}) {
			for (const id of ["one", "two", "three"]) {
				approveWork(id, `board-${id}`);
				setAreas(id, [id === "three" ? "work-board" : "work-fleet/schema"]);
				yield* preparePredictionWork(id);
			}
			yield* fleet.dispatch("one");
			pushWorkerBranch("one", { [MIGRATION_PATH]: "export const migrations = { first: first };\n" });
			const first = publishedPredictionResult("one");
			checksRespond(first.head, [[checkRun({ headSha: first.head, name: "verify" })]]);
			finishWorkers();
			const ready = (yield* fleet.reconcile("one")).value;
			expect(ready.decision?.code).toBe("reviewed-pr-ready");
			advanceTime(1001);
			for (const id of ["two", "three"]) {
				yield* fleet.dispatch(id);
				pushWorkerBranch(id, { [MIGRATION_PATH]: `export const migrations = { ${id}: ${id} };\n` });
				finishWorkers();
				const held = (yield* fleet.reconcile(id)).value;
				expect(held.blocker).toContain(`waiting for ${first.pr} to merge`);
			}
			yield* restart();
			if (repair === "checks") {
				checksRespond(first.head, [[checkRun({ conclusion: "failure", headSha: first.head, name: "verify" })]]);
			}
			const decision = ready.decision?.id ?? "missing";
			yield* fleet.resolve("one", decision, respond(decision, "retry"));
			yield* fleet.reconcile("one");
			if (repair === "checks") {
				finishWorkers();
				yield* fleet.reconcile("one");
			}
			const repairing = (yield* fleet.get("one")).value;
			expect(repairing).toMatchObject({ result: first, step: "working" });
			expect(repairing.blocker).toBeUndefined();
			expect(repairing.attempts.at(-1)).toMatchObject({ receipt: { sessionId: ready.attempts[0]?.receipt?.sessionId }, role: "repair" });
			expect(repairing.attempts.at(-1)?.prompt).toContain(first.pr);
			setAreas("four", ["work-fleet/schema"]);
			approveWork("four", "board-four");
			yield* preparePredictionWork("four");
			expect(yield* fleet.dispatch("four").pipe(Effect.flip)).toMatchObject({ message: "waiting for area work-fleet/schema held by one" });
			checksRespond(first.head, [[checkRun({ headSha: first.head, name: "verify" })]]);
			finishWorkers();
			yield* fleet.reconcile("one");
			mergeWatchedPr("one");
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			const resumed = (yield* fleet.reconcile("two")).value;
			expect(resumed).toMatchObject({ step: "working" });
			expect(resumed.attempts.at(-1)).toMatchObject({ prompt: expect.stringContaining(first.pr), role: "repair" });
		},
	);
}
