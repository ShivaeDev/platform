import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { backlog } from "#model.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { HEAD, MOVED } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresTests } from "#test/postgres.ts";
import { startReview } from "#test/startReview.ts";

const test = postgresTests("test");

for (const head of [HEAD, MOVED]) {
	for (const pending of [false, true]) {
		test(`a human merge at ${head} during review releases once the reviewer is terminal with ${pending ? "pending" : "green"} checks`, () =>
			Effect.scoped(
				Effect.gen(function* () {
					const github = yield* mergedReviewGithub();
					yield* withEngine({ ...github, reviewRunning: true }, (fixture) =>
						Effect.gen(function* () {
							const reviewing = yield* startReview(fixture);
							const fleet = yield* Fleet;
							github.state.status = "MERGED";
							github.state.head = head;
							github.state.pending = pending;
							expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
							finishWorkers(fixture);
							const observed = yield* fleet.reconcile("one");
							expect(observed.value.stage).toBe("released");
							expect(observed.value.releaseReason).toBe(`PR #7 merged by a human at ${head}; Fleet review covered nothing`);
							expect(observed.value.outcome).toBeUndefined();
							expect(observed.value.review).toBeUndefined();
							expect(observed.value.checks).toBeUndefined();
							expect(observed.value.result).toEqual(reviewing.value.result);
							expect(backlog(observed.value)).toBe(false);
							expect((yield* fleet.reconcile("one")).version).toBe(observed.version);
							expect(fixture.launched).toHaveLength(2);
							expect(fixture.reviews).toEqual([HEAD]);
							expect(fixture.merged).toEqual([]);
							expect(github.requests.filter((request) => request === "/repos/example/repository/pulls/7").length).toBeGreaterThan(2);
						}),
					);
				}),
			));
	}
}

for (const scenario of [
	{
		head: HEAD,
		name: "closure without merge",
		reason: "Reported PR must be open or merged and target the configured repository branch",
		status: "CLOSED",
	},
] as const) {
	test(`${scenario.name} during review retains ownership and waits on the orchestrator`, () =>
		Effect.scoped(
			Effect.gen(function* () {
				const github = yield* mergedReviewGithub();
				yield* withEngine({ ...github, reviewRunning: true }, (fixture) =>
					Effect.gen(function* () {
						const reviewing = yield* startReview(fixture);
						github.state.status = scenario.status;
						github.state.head = scenario.head;
						finishWorkers(fixture);
						const fleet = yield* Fleet;
						const observed = yield* fleet.reconcile("one");
						expect(observed.value.stage).toBe("needs-human");
						expect(observed.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
						expect(observed.value.decision?.reason).toContain(scenario.reason);
						expect(observed.value.outcome).toBeUndefined();
						expect(backlog(observed.value)).toBe(true);
						expect(observed.value.result).toEqual(reviewing.value.result);
						expect(fixture.launched).toHaveLength(2);
						expect(fixture.reviews).toEqual([HEAD]);
						expect(fixture.merged).toEqual([]);
					}),
				);
			}),
		));
}
