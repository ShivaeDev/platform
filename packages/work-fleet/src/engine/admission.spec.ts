import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("Fleet admission path", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
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
	for (const path of ["src/one.ts", "pnpm-lock.yaml", "script/update", "quality.config.ts", "packages/example/quality-baseline.json"]) {
		test(`reprepares affected work after ${path} changes`, () =>
			withEngine({ mainChanges: [path] }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					expect((yield* fleet.dispatch("one")).value.stage).toBe("needs-human");
					expect(fixture.launched).toHaveLength(0);
				}),
			));
	}
	test("native overlapping owners block only their scope", () =>
		withEngine({ foreign: ["src/one.ts"] }, (fixture) =>
			Effect.gen(function* () {
				expect(yield* Effect.flip(prepareWork("one"))).toMatchObject({ _tag: "StorageOwnershipConflict" });
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("two");
				expect(fixture.launched).toHaveLength(1);
			}),
		));
	test("foreign ownership arriving after prepare blocks dispatch", () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* fixture.foreign("human-pr", ["src/one.ts"]);
				const fleet = yield* Fleet;
				expect((yield* fleet.dispatch("one")).value.stage).toBe("needs-human");
				expect(fixture.launched).toHaveLength(0);
			}),
		));
	test("one unit of quota cannot admit two concurrent disjoint submissions", () =>
		withEngine({ quota: 1 }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				yield* Effect.all([fleet.dispatch("one").pipe(Effect.result), fleet.dispatch("two").pipe(Effect.result)], { concurrency: "unbounded" });
				expect(fixture.launched).toHaveLength(1);
			}),
		));
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
				yield* fixture.foreign("human-pr", ["other/file.ts"]);
				finishWorkers(fixture);
				yield* fleet.dispatch("two").pipe(Effect.result);
				expect((yield* fleet.get("two")).value.blocker).toContain("backlog");
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
			}),
		));
});
