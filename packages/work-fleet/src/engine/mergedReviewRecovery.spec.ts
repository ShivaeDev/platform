import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { backlog } from "#model.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { BASE, HEAD, PR } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { startReview } from "#test/startReview.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("retry of a stored post-review open-PR failure completes after restart without another session", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const github = yield* mergedReviewGithub();
			yield* withEngine({ ...github, reviewRunning: true }, (fixture) =>
				Effect.gen(function* () {
					const reviewing = yield* startReview(fixture);
					const fleet = yield* Fleet;
					github.state.status = "MERGED";
					github.state.legacyResult = true;
					finishWorkers(fixture);
					const blocked = yield* fleet.reconcile("one");
					expect(blocked.value.stage).toBe("needs-human");
					expect(blocked.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
					expect(blocked.value.decision?.reason).toBe("Reported PR must be open and target the configured repository branch");
					expect(blocked.value.review).toMatchObject({ head: HEAD, verdict: "approved" });
					expect(blocked.value.checks).toBeUndefined();
					const decisionId = blocked.value.decision?.id ?? "missing";
					const responseId = fixture.respond(decisionId, "retry");
					github.state.legacyResult = false;
					const completed = yield* fixture.restart(
						Effect.gen(function* () {
							const restarted = yield* Fleet;
							yield* restarted.resolve("one", decisionId, responseId);
							return yield* restarted.reconcile("one");
						}),
					);
					expect(completed.value.stage).toBe("completed");
					expect(completed.value.outcome).toEqual({ head: HEAD, revision: BASE, url: PR });
					expect(completed.value.checks).toMatchObject({ head: HEAD, passed: true });
					expect(completed.value.result).toEqual(reviewing.value.result);
					expect(backlog(completed.value)).toBe(false);
					expect(completed.value.responses).toMatchObject([{ action: "retry", decisionId, responseId }]);
					expect(fixture.launched).toHaveLength(2);
					expect(fixture.reviews).toEqual([HEAD]);
					expect(fixture.merged).toEqual([]);
				}),
			);
		}),
	));
