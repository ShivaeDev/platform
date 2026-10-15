import { Effect } from "effect";
import { expect } from "vitest";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

test("a dependency chain launches in order after validated completion", () =>
	withEngine({ noChange: true }, (fixture) =>
		Effect.gen(function* () {
			fixture.dependencies("two", ["one"]);
			fixture.dependencies("dependent", ["two"]);
			for (const id of ["dependent", "two", "one"]) {
				yield* prepareWork(id);
			}
			const fleet = yield* Fleet;
			yield* cycle;
			expect((yield* fleet.get("two")).value.blocker).toContain("waiting for dependency one");
			expect((yield* fleet.get("two")).value.attentionOwner).toBe("automation");
			expect((yield* fleet.get("dependent")).value.blocker).toContain("waiting for dependency two");
			for (const id of ["one", "two"]) {
				finishWorkers(fixture);
				expect((yield* fleet.reconcile(id)).value.stage).toBe("completed");
				yield* fixture.restart(cycle);
			}
			expect(fixture.starts.filter((start) => start.access !== "read-only").map((start) => start.prompt)).toEqual([
				"Implement one",
				"Implement two",
				"Implement dependent",
			]);
		}),
	));

test("a done Board dependency qualifies only when it has no Fleet work", () =>
	withEngine({}, (fixture) =>
		Effect.gen(function* () {
			fixture.dependencies("dependent", ["external"]);
			yield* prepareWork("dependent");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("dependent").pipe(Effect.result);
			expect((yield* fleet.get("dependent")).value.blocker).toContain("Board status done");
			fixture.boardStatus("external", "done");
			expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
			fixture.dependencies("two", ["one"]);
			fixture.boardStatus("one", "done");
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value.stage).toBe("prepared");
			expect(fixture.starts).toHaveLength(1);
		}),
	));

test("a dependency that shares an area with an earlier dependent can still launch", () =>
	withEngine({}, (fixture) =>
		Effect.gen(function* () {
			fixture.areas("dependent", ["fleet/host"]);
			fixture.areas("one", ["fleet/host"]);
			yield* prepareWork("dependent");
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("dependent").pipe(Effect.result);
			expect((yield* fleet.dispatch("one")).value.stage).toBe("executing");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
		}),
	));
