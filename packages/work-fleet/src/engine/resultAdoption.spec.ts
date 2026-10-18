import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { engine } from "#test/engineStory.ts";
import { HEAD, NO_CHANGE, PR, REPORT } from "#test/githubResult.ts";
import {
	mainMovesBeforeNoChange,
	reportedPullRequestIsInvalid,
	workerReportsChangedPaths,
	workerReportsNoChange,
} from "#test/resultAdoptionScenarios.ts";

describe("host result adoption through Fleet and PostgreSQL", () => {
	{
		const setup = workerReportsChangedPaths();
		engine.it(
			"persists the observed PR number, exact head and paths before independent review",
			[setup.given],
			function* ({ fixture, fleet, prepareWork, restart, workerReports }) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				workerReports(REPORT);
				const reviewing = yield* fleet.reconcile("one");
				expect(reviewing.value.stage).toBe("reviewing");
				expect(reviewing.value.result).toEqual({ head: HEAD, kind: "change", paths: ["src/one.ts"], pr: PR, prNumber: 7 });
				const recovered = yield* restart(Effect.flatMap(Fleet, (restarted) => restarted.get("one")));
				expect(recovered.value.result).toEqual(reviewing.value.result);
				expect(fixture.reviews).toEqual([HEAD]);
			},
		);
	}

	{
		const setup = workerReportsNoChange();
		engine.it(
			"holds a reported no-change claim for terminal independent review and required checks",
			[setup.given],
			function* ({ fixture, fleet, prepareWork, finishWorkers, workerReports }) {
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
				expect(fixture.merged).toHaveLength(0);
			},
		);
	}

	for (const changedTask of [false, true]) {
		{
			const setup = mainMovesBeforeNoChange();
			engine.it(
				`no-change after main moves ${changedTask ? "completes for an approved edited task" : "completes for the same task revision"}`,
				[setup.given],
				function* ({ fixture, fleet, prepareWork, editWork, approveWork, workerReports }) {
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
					expect(fixture.merged).toHaveLength(0);
				},
			);
		}
	}

	for (const scenario of [{ options: { before: { state: "closed" } }, output: REPORT }]) {
		{
			const setup = reportedPullRequestIsInvalid(scenario);
			engine.it(
				`failed adoption requires a human decision before review: ${JSON.stringify(scenario)}`,
				[setup.given],
				function* ({ fixture, fleet, prepareWork, workerReports }) {
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					workerReports(scenario.output);
					const blocked = yield* fleet.reconcile("one");
					expect(blocked.value.stage).toBe("needs-human");
					expect(blocked.value.attentionOwner).toBe("orchestrator");
					expect(blocked.value.decision?.attentionOwner).toBe("orchestrator");
					expect(blocked.value.result).toBeUndefined();
					expect(fixture.reviews).toHaveLength(0);
					expect(fixture.merged).toHaveLength(0);
				},
			);
		}
	}
});
