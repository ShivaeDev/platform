import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { backlog } from "#model.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { BASE, HEAD, MOVED, PR } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { startReview } from "#test/startReview.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

for (const pending of [false, true]) {
	test(`a human merge during review completes at the approved head after ${pending ? "pending" : "green"} checks`, () =>
		Effect.scoped(
			Effect.gen(function* () {
				const github = yield* mergedReviewGithub();
				yield* withEngine({ ...github, reviewRunning: true }, (fixture) =>
					Effect.gen(function* () {
						const reviewing = yield* startReview(fixture);
						const fleet = yield* Fleet;
						github.state.status = "MERGED";
						github.state.pending = pending;
						finishWorkers(fixture);
						let observed = yield* fleet.reconcile("one");
						if (pending) {
							expect(observed.value.stage).toBe("validating");
							expect(observed.value.outcome).toBeUndefined();
							github.state.pending = false;
							observed = yield* fleet.reconcile("one");
						}
						expect(observed.value.stage).toBe("completed");
						expect(observed.value.outcome).toEqual({ head: HEAD, revision: BASE, url: PR });
						expect(observed.value.review).toMatchObject({ head: HEAD, verdict: "approved" });
						expect(observed.value.checks).toMatchObject({ head: HEAD, passed: true });
						expect(observed.value.result).toEqual(reviewing.value.result);
						expect(backlog(observed.value)).toBe(false);
						expect((yield* fleet.reconcile("one")).version).toBe(observed.version);
						expect(fixture.launched).toHaveLength(2);
						expect(fixture.reviews).toEqual([HEAD]);
						expect(fixture.merged).toEqual([]);
						expect(github.requests).toContain("/delivery");
					}),
				);
			}),
		));
}

for (const scenario of [
	{ head: MOVED, name: "an unreviewed merged head", reason: "Merged PR head differs from the reported head", status: "MERGED" },
	{
		head: HEAD,
		name: "closure without merge",
		reason: "Reported PR must be open or merged and target the configured repository branch",
		status: "CLOSED",
	},
] as const) {
	test(`${scenario.name} during review retains ownership and waits for a human`, () =>
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
