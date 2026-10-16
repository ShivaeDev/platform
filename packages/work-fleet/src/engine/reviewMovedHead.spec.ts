import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { HEAD, MOVED } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresTests } from "#test/postgres.ts";
import { startReview } from "#test/startReview.ts";

postgresTests("test")("a push after review starts gets a fresh review without a recovery decision", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const github = yield* mergedReviewGithub();
			yield* withEngine({ ...github, reviewRunning: true }, (fixture) =>
				Effect.gen(function* () {
					yield* startReview(fixture);
					const fleet = yield* Fleet;
					github.state.head = MOVED;
					yield* fleet.reconcile("one");
					expect(fixture.launched).toHaveLength(2);
					expect(fixture.decisions).toHaveLength(0);
					finishWorkers(fixture);
					yield* fixture.restart(fleet.reconcile("one"));
					const fresh = (yield* fleet.reconcile("one")).value;
					expect(fresh.stage).toBe("reviewing");
					expect(fresh.result?.head).toBe(MOVED);
					expect(fresh.attempts.at(-1)).toMatchObject({ reviewHead: MOVED, role: "reviewer", status: "running" });
					expect(fixture.decisions).toHaveLength(0);
					finishWorkers(fixture);
					const ready = (yield* fleet.reconcile("one")).value;
					expect(ready.review).toMatchObject({ head: MOVED, verdict: "approved" });
					expect(ready.checks).toMatchObject({ head: MOVED, passed: true });
					expect(ready.decision?.code).toBe("reviewed-pr-ready");
					expect(fixture.decisions).toHaveLength(1);
					expect(fixture.reviews).toEqual([HEAD, MOVED]);
				}),
			);
		}),
	),
);
