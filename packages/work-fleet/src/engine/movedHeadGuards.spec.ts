import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { HEAD, MOVED } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresTests } from "#test/postgres.ts";
import { startReview } from "#test/startReview.ts";

const test = postgresTests("test");

for (const contextChanged of [false, true]) {
	test(`a moved head with ${contextChanged ? "changed Board context" : "paths outside the reserved scope"} requires a decision before another review`, () =>
		Effect.scoped(
			Effect.gen(function* () {
				const github = yield* mergedReviewGithub();
				yield* withEngine({ ...github, reviewRunning: true }, (fixture) =>
					Effect.gen(function* () {
						yield* startReview(fixture);
						const fleet = yield* Fleet;
						finishWorkers(fixture);
						const approved = yield* fleet.reconcile("one");
						github.state.head = MOVED;
						if (contextChanged) {
							fixture.editWork("one", "new-context");
						} else {
							github.state.paths = ["src/one.ts", "src/outside.ts"];
						}
						const held = yield* fleet.reconcile("one");
						expect(held.value.stage).toBe("needs-human");
						expect(held.value.decision?.reason).toBe(contextChanged ? "Board context changed" : "Result needs evidence and known reserved scope");
						expect(held.value.attentionOwner).toBe("orchestrator");
						expect(held.value.result).toEqual(approved.value.result);
						expect(held.value.review).toEqual(contextChanged ? undefined : approved.value.review);
						expect(held.value.mergeReadyAt).toBeUndefined();
						expect(held.value.outcome).toBeUndefined();
						expect(fixture.reviews).toEqual([HEAD]);
						expect(fixture.launched).toHaveLength(2);
					}),
				);
			}),
		));
}
