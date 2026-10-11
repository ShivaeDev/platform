import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { backlog } from "#model.ts";
import { type EngineFixture, finishWorkers, withEngine } from "#test/engine.ts";
import { BASE, HEAD, PR } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { reportWorker } from "#test/reportWorker.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

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
	test(`a PR merged before adoption ${retry ? "retries the stored decision" : "adopts the report"} then requires review and checks`, () =>
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
							expect(reviewing.value.decision?.reason).toBe("Reported PR must be open and target the configured repository branch");
							expect(reviewing.value.result).toBeUndefined();
							expect(fixture.launched).toHaveLength(1);
							expect(fixture.reviews).toEqual([]);
							const decisionId = reviewing.value.decision?.id ?? "missing";
							const responseId = fixture.respond(decisionId, "retry");
							github.state.legacyResult = false;
							reviewing = yield* retryAdoption(fixture, decisionId, responseId);
						}
						expect(reviewing.value.stage).toBe("reviewing");
						expect(reviewing.value.result).toMatchObject({ head: HEAD, paths: ["src/one.ts"], pr: PR, prNumber: 7 });
						expect(reviewing.value.outcome).toBeUndefined();
						expect(reviewing.value.review).toBeUndefined();
						expect(reviewing.value.checks).toBeUndefined();
						expect(reviewing.value.attempts[0]).toEqual(worker);
						finishWorkers(fixture);
						const completed = yield* fleet.reconcile("one");
						expect(completed.value.stage).toBe("completed");
						expect(completed.value.review).toMatchObject({ head: HEAD, verdict: "approved" });
						expect(completed.value.checks).toMatchObject({ head: HEAD, passed: true });
						expect(completed.value.outcome).toEqual({ head: HEAD, revision: BASE, url: PR });
						expect(backlog(completed.value)).toBe(false);
						expect(fixture.launched).toHaveLength(2);
						expect(fixture.reviews).toEqual([HEAD]);
						expect(fixture.merged).toEqual([]);
					}),
				);
			}),
		));
}

test("a merged PR requesting changes remains undelivered and follows the normal repair path", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const github = yield* mergedReviewGithub();
			github.state.status = "MERGED";
			yield* withEngine({ ...github, repairs: true }, (fixture) =>
				Effect.gen(function* () {
					yield* reportWorker(fixture);
					const fleet = yield* Fleet;
					const repairing = yield* fleet.reconcile("one");
					expect(repairing.value.stage).toBe("executing");
					expect(repairing.value.review?.verdict).toBe("changes");
					expect(repairing.value.attempts.at(-1)?.role).toBe("repair");
					expect(repairing.value.outcome).toBeUndefined();
					expect(backlog(repairing.value)).toBe(true);
					expect(fixture.reviews).toEqual([HEAD]);
					expect(fixture.merged).toEqual([]);
				}),
			);
		}),
	));
