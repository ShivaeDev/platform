import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { cycle } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { githubDelivery } from "#host/githubDelivery.ts";
import { backlog, executing } from "#model.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);
const result = { head: "reviewed-head", kind: "change", paths: ["src/one.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
const open = { headRefOid: result.head, mergeCommit: null, mergedAt: null, state: "OPEN", url: result.pr };
const merged = { ...open, mergeCommit: { oid: "merged-revision" }, mergedAt: "2026-01-01T00:00:00Z", state: "MERGED" };

test("green work never submits a merge and a restarted scheduler accepts the human merge once", () => {
	let observation: unknown = open;
	const deliveryQuery = githubDelivery("/repository", () => Effect.succeed(observation));
	return withEngine({ deliveryQuery, resultQuery: () => Effect.succeed(result) }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const ready = yield* fleet.reconcile("one");
			expect(ready.value.stage).toBe("needs-human");
			expect(ready.value.decision?.reason).toBe("Reviewed PR is ready to merge");
			expect(ready.value.review?.head).toBe(result.head);
			expect(ready.value.checks).toMatchObject({ head: result.head, passed: true });
			expect(backlog(ready.value)).toBe(true);
			expect(executing(ready.value)).toBe(false);
			expect((yield* fleet.reconcile("one")).version).toBe(ready.version);
			expect(ready.value.deliverySubmitted).toBe(false);
			observation = merged;
			yield* fixture.restart(cycle);
			const accepted = yield* fleet.get("one");
			expect(accepted.value.stage).toBe("completed");
			expect(accepted.value.outcome).toEqual({ head: result.head, revision: "merged-revision", url: result.pr });
			expect(backlog(accepted.value)).toBe(false);
			const completedViews = views((yield* fleet.list()).map(({ value }) => value));
			expect(completedViews.needsHuman).toEqual([]);
			expect(completedViews.completed[0]?.blocker).toBeUndefined();
			expect(completedViews.completed[0]?.decision).toBeUndefined();
			expect(accepted.value.decision?.published).toBeDefined();
			expect((yield* fleet.reconcile("one")).version).toBe(accepted.version);
			expect(fixture.launched).toHaveLength(2);
			expect(fixture.reviews).toHaveLength(1);
			expect(fixture.merged).toEqual([]);
		}),
	);
});

test("a PR closed without merging replaces the ready decision with that fact", () => {
	let observation: unknown = open;
	const deliveryQuery = githubDelivery("/repository", () => Effect.succeed(observation));
	return withEngine({ deliveryQuery, resultQuery: () => Effect.succeed(result) }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			observation = { ...open, state: "CLOSED" };
			yield* fixture.restart(cycle);
			const closed = yield* fleet.get("one");
			expect(closed.value.stage).toBe("needs-human");
			expect(closed.value.decision?.reason).toContain("closed without merging");
			expect(closed.value.outcome).toBeUndefined();
			expect(backlog(closed.value)).toBe(true);
			expect((yield* fleet.reconcile("one")).version).toBe(closed.version);
			expect(fixture.merged).toEqual([]);
		}),
	);
});

test("a human merge of a changed head cannot reuse the old review and checks", () => {
	let observation: unknown = open;
	const deliveryQuery = githubDelivery("/repository", () => Effect.succeed(observation));
	return withEngine({ deliveryQuery, resultQuery: () => Effect.succeed(result) }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			observation = { ...merged, headRefOid: "unreviewed-head" };
			const blocked = yield* fleet.reconcile("one");
			expect(blocked.value.stage).toBe("needs-human");
			expect(blocked.value.decision?.reason).toContain("differs from the reviewed head");
			expect(blocked.value.outcome).toBeUndefined();
			expect(backlog(blocked.value)).toBe(true);
		}),
	);
});

for (const state of ["CLOSED", "MERGED"] as const) {
	test(`observes ${state} without accepting unreviewed work`, () => {
		const observation = state === "CLOSED" ? { ...open, state } : merged;
		const deliveryQuery = githubDelivery("/repository", () => Effect.succeed(observation));
		return withEngine({ deliveryQuery, resultQuery: () => Effect.succeed(result), sameReviewer: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				const observed = yield* fleet.reconcile("one");
				expect(observed.value.stage).toBe("needs-human");
				expect(observed.value.decision?.reason).toContain(state === "CLOSED" ? "closed without merging" : "Independent review");
				expect(observed.value.outcome).toBeUndefined();
				expect(backlog(observed.value)).toBe(true);
			}),
		);
	});
}
