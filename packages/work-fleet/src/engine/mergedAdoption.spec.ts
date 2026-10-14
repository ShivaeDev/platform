import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { backlog } from "#model.ts";
import { type EngineFixture, withEngine } from "#test/engine.ts";
import { HEAD, PR } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresTests } from "#test/postgres.ts";
import { reportWorker } from "#test/reportWorker.ts";

const test = postgresTests("test");

function retryAdoption(fixture: EngineFixture, decisionId: string, responseId: string) {
	return fixture.restart(
		Effect.gen(function* () {
			const restarted = yield* Fleet;
			const resumed = yield* restarted.resolve("one", decisionId, responseId);
			expect(resumed.value.stage).toBe("adopting");
			return yield* restarted.reconcile("one");
		}),
	);
}

for (const retry of [false, true]) {
	test(`a PR merged before adoption ${retry ? "retries the stored decision" : "adopts the report"} then releases without starting review`, () =>
		Effect.scoped(
			Effect.gen(function* () {
				const github = yield* mergedReviewGithub();
				github.state.status = "MERGED";
				github.state.legacyResult = retry;
				yield* withEngine({ ...github, reviewRunning: true }, (fixture) =>
					Effect.gen(function* () {
						yield* reportWorker(fixture);
						const fleet = yield* Fleet;
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
							const responseId = fixture.respond(decisionId, "retry");
							github.state.legacyResult = false;
							reviewing = yield* retryAdoption(fixture, decisionId, responseId);
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
					}),
				);
			}),
		));
}
