import { describe, expect } from "@effect/vitest";
import {
	mainMovesBeforeNoChange,
	reportedPullRequestIsClosed,
	workerReportsChangedPaths,
	workerReportsNoChange,
} from "#test/engineAdoptionTraits.ts";
import { engine } from "#test/engineStory.ts";
import { HEAD, NO_CHANGE, PR, REPORT } from "#test/githubResult.ts";

describe("host result adoption through Fleet and PostgreSQL", () => {
	engine.it(
		"persists the observed PR number, exact head and paths before independent review",
		[workerReportsChangedPaths()],
		function* ({ fleet, prepareWork, restart, workerReports, reviewedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			const reviewing = yield* fleet.reconcile("one");
			expect(reviewing.value.stage).toBe("reviewing");
			expect(reviewing.value.result).toEqual({ head: HEAD, kind: "change", paths: ["src/one.ts"], pr: PR, prNumber: 7 });
			yield* restart();
			const recovered = yield* fleet.get("one");
			expect(recovered.value.result).toEqual(reviewing.value.result);
			expect(reviewedHeads()).toEqual([HEAD]);
		},
	);
	engine.it(
		"holds a reported no-change claim for terminal independent review and required checks",
		[workerReportsNoChange()],
		function* ({ fleet, prepareWork, finishWorkers, workerReports, mergedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(NO_CHANGE);
			const reviewing = yield* fleet.reconcile("one");
			expect(reviewing.value.stage).toBe("reviewing");
			expect(reviewing.value.result).toEqual({ evidence: [NO_CHANGE], head: HEAD, kind: "no-change" });
			expect(reviewing.value.outcome).toBeUndefined();
			expect(reviewing.value.checks).toBeUndefined();
			expect(reviewing.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(reviewing.value.attempts[0]?.receipt?.sessionId);
			finishWorkers();
			const accepted = yield* fleet.reconcile("one");
			expect(accepted.value.stage).toBe("completed");
			expect(accepted.value.review?.head).toBe(HEAD);
			expect(accepted.value.checks?.head).toBe(HEAD);
			expect(accepted.value.outcome).toMatchObject({ evidence: [NO_CHANGE] });
			expect(mergedHeads()).toHaveLength(0);
		},
	);
	for (const changedTask of [false, true]) {
		engine.it(
			`no-change after main moves ${changedTask ? "completes for an approved edited task" : "completes for the same task revision"}`,
			[mainMovesBeforeNoChange()],
			function* ({ fleet, prepareWork, editWork, approveWork, workerReports, mergedHeads }) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				workerReports(NO_CHANGE);
				if (changedTask) {
					editWork("one", "board-one-next");
					approveWork("one", "board-one-next");
				}
				const reconciled = yield* fleet.reconcile("one");
				expect(reconciled.value.boardRevision).toBe(changedTask ? "board-one-next" : "board-one");
				expect(reconciled.value.decision).toBeUndefined();
				expect(reconciled.value.stage).toBe("completed");
				expect(reconciled.value.result).toEqual({ evidence: [NO_CHANGE], head: HEAD, kind: "no-change" });
				expect(reconciled.value.checks?.head).toBe(HEAD);
				expect(reconciled.value.outcome).toMatchObject({ evidence: [NO_CHANGE] });
				expect(mergedHeads()).toHaveLength(0);
			},
		);
	}
	engine.it(
		"a closed reported pull request requires a human decision before review",
		[reportedPullRequestIsClosed()],
		function* ({ fleet, prepareWork, workerReports, reviewedHeads, mergedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			const blocked = yield* fleet.reconcile("one");
			expect(blocked.value.stage).toBe("needs-human");
			expect(blocked.value.attentionOwner).toBe("orchestrator");
			expect(blocked.value.decision?.attentionOwner).toBe("orchestrator");
			expect(blocked.value.result).toBeUndefined();
			expect(reviewedHeads()).toHaveLength(0);
			expect(mergedHeads()).toHaveLength(0);
		},
	);
});
