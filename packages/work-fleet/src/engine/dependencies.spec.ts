import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#fleet.ts";
import { acceptDependency } from "#test/acceptDependency.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

test("current dependency revision requires fresh accepted completion while unrelated work dispatches", () =>
	withEngine({ noChange: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			expect((yield* acceptDependency(fixture)).value.step).toBe("done");
			fixture.editWork("one", "board-one-changed");
			fixture.approveWork("one", "board-one-changed");
			yield* prepareWork("dependent");
			yield* prepareWork("two");
			const fleet = yield* Fleet;
			expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
			expect((yield* fleet.get("dependent")).value.blocker).toContain("board-one-changed");
			expect((yield* fleet.dispatch("two")).value.step).toBe("working");
			yield* prepareWork("one");
			expect((yield* acceptDependency(fixture)).value.step).toBe("done");
			expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
			expect((yield* fleet.get("dependent")).value.blocker).toBeUndefined();
		}),
	));

test("unavailable or ambiguous current Board dependency never reuses a historical accepted outcome", () =>
	withEngine({ noChange: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			yield* acceptDependency(fixture);
			yield* prepareWork("dependent");
			fixture.unavailableWork("one", true);
			const fleet = yield* Fleet;
			yield* fleet.dispatch("dependent").pipe(Effect.flip);
			expect((yield* fleet.get("dependent")).value.blocker).toContain("unavailable or ambiguous");
			fixture.unavailableWork("one", false);
			expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
		}),
	));

test("criterion-specific dependencies do not inherit whole-work acceptance", () =>
	withEngine({ noChange: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			yield* acceptDependency(fixture);
			fixture.dependencies("dependent", ["one#criterion"]);
			yield* prepareWork("dependent");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("dependent").pipe(Effect.flip);
			expect((yield* fleet.get("dependent")).value.blocker).toContain("criterion-specific accepted evidence");
			expect(fixture.launched).toHaveLength(2);
		}),
	));
