import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

describe("Fleet admission path", () => {
	const test = postgresTests("test");
	const concurrentTest = postgresTests("test", "isolated");
	test("refreshes an unrelated main change while preserving prior validation revision", () =>
		withEngine({}, () =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				const launched = yield* fleet.dispatch("one");
				expect(launched.value.preparation.baseRevision).toBe("current-main");
				expect(launched.value.preparation.validation[0]?.revision).toBe("prepared-main");
			}),
		));
	test("reprepares work whose source changed on main", () =>
		withEngine({ mainChanges: ["src/one.ts"] }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				expect((yield* fleet.dispatch("one")).value.stage).toBe("needs-human");
				expect(fixture.launched).toHaveLength(0);
			}),
		));
	test("work with overlapping scope and foreign PRs dispatches concurrently", () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				for (const workId of ["one", "two"]) {
					yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["."] }), prompt: `Implement ${workId}`, workId });
				}
				yield* fixture.foreign("human-pr");
				expect((yield* fleet.dispatch("one")).value.stage).toBe("executing");
				expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
				expect(fixture.launched).toHaveLength(2);
			}),
		));
	concurrentTest("one unit of quota cannot admit two concurrent disjoint submissions", () =>
		withEngine({ quota: 1 }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				yield* Effect.all([fleet.dispatch("one").pipe(Effect.result), fleet.dispatch("two").pipe(Effect.result)], { concurrency: "unbounded" });
				expect(fixture.launched).toHaveLength(1);
			}),
		),
	);
	test("unknown quota remains prepared with a concrete blocker", () =>
		withEngine({ unknownQuota: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one").pipe(Effect.result);
				expect((yield* fleet.get("one")).value.blocker).toContain("quota");
				expect(fixture.launched).toHaveLength(0);
			}),
		));
	test("the production repository rejects a submission behind an area waiter", () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				fixture.areas("one", ["fleet/host"]);
				fixture.areas("two", ["fleet/host"]);
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				const rejected = yield* Effect.flip(fleet.dispatch("two"));
				expect(rejected).toMatchObject({ message: "waiting for area fleet/host queued ahead by one" });
				expect((yield* fleet.get("two")).value).toMatchObject({
					attempts: [],
					blocker: "waiting for area fleet/host queued ahead by one",
					stage: "prepared",
				});
				expect(fixture.launched).toHaveLength(0);
				expect((yield* fleet.dispatch("one")).value.stage).toBe("executing");
			}),
		));
	test("only dependents wait for accepted outcomes", () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("dependent");
				yield* prepareWork("two");
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("dependent").pipe(Effect.result);
				yield* fleet.dispatch("two");
				expect(fixture.launched).toHaveLength(1);
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
			}),
		));
	test("completion drains a full foreign backlog while new workers defer", () =>
		withEngine({ backlog: 1 }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				yield* fixture.foreign("human-pr");
				finishWorkers(fixture);
				yield* fleet.dispatch("two").pipe(Effect.result);
				expect((yield* fleet.get("two")).value.blocker).toContain("backlog");
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
			}),
		));
});
