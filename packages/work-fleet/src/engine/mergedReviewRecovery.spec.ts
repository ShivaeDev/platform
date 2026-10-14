import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { backlog } from "#model.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { HEAD } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresTests } from "#test/postgres.ts";
import { startReview } from "#test/startReview.ts";

const test = postgresTests("test");

test("a merged PR releases after terminal review even when result refresh would reject merged PRs", () =>
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
					const released = yield* fleet.reconcile("one");
					expect(released.value.stage).toBe("released");
					expect(released.value.releaseReason).toBe(`PR #7 merged by a human at ${HEAD}; Fleet review covered nothing`);
					expect(released.value.outcome).toBeUndefined();
					expect(released.value.result).toEqual(reviewing.value.result);
					expect(backlog(released.value)).toBe(false);
					expect((yield* fixture.restart(fleet.reconcile("one"))).version).toBe(released.version);
					expect(fixture.launched).toHaveLength(2);
					expect(fixture.reviews).toEqual([HEAD]);
					expect(fixture.merged).toEqual([]);
				}),
			);
		}),
	));
