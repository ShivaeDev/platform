import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { backlog } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { HEAD, PR, REPORT } from "#test/githubResult.ts";

for (const retry of [false, true]) {
	engine.it(
		`a PR merged before adoption ${retry ? "retries the stored decision" : "adopts the report"} then releases without starting review`,
		[githubPullRequest({ legacyResult: retry, status: "MERGED" }), reviewerStillRunning()],
		function* ({ fixture, fleet, respond, restart, pullRequest, prepareWork, workerReports }) {
			const github = pullRequest();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			let reviewing = yield* fleet.reconcile("one");
			const worker = reviewing.value.attempts[0];
			if (retry) {
				expect(reviewing.value.stage).toBe("needs-human");
				expect(reviewing.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
				expect(reviewing.value.decision?.reason).toBe("Reported PR must be open and target the configured repository branch");
				expect(reviewing.value.result).toBeUndefined();
				expect(fixture.launched).toHaveLength(1);
				expect(fixture.reviews).toEqual([]);
				const decisionId = reviewing.value.decision?.id ?? "missing";
				const responseId = respond(decisionId, "retry");
				github.state.legacyResult = false;
				reviewing = yield* restart(
					Effect.gen(function* () {
						const resumed = yield* fleet.resolve("one", decisionId, responseId);
						expect(resumed.value.stage).toBe("adopting");
						return yield* fleet.reconcile("one");
					}),
				);
			}
			expect(reviewing.value.stage).toBe("released");
			expect(reviewing.value.result).toMatchObject({ head: HEAD, paths: ["src/one.ts"], pr: PR, prNumber: 7 });
			expect(reviewing.value.releaseReason).toBe(`PR #7 merged by a human at ${HEAD}; Fleet review covered nothing`);
			expect(reviewing.value.outcome).toBeUndefined();
			expect(reviewing.value.review).toBeUndefined();
			expect(reviewing.value.checks).toBeUndefined();
			expect(reviewing.value.attempts[0]).toMatchObject(worker ?? {});
			expect(backlog(reviewing.value)).toBe(false);
			expect(fixture.launched).toHaveLength(1);
			expect(fixture.reviews).toEqual([]);
			expect(fixture.merged).toEqual([]);
		},
	);
}
