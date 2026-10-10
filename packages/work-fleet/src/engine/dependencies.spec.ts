import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { acceptDependency } from "#test/acceptDependency.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("current dependency revision requires fresh accepted completion while unrelated work dispatches", () =>
	withEngine({ noChange: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			expect((yield* acceptDependency(fixture)).value.stage).toBe("completed");
			fixture.editWork("one", "board-one-changed");
			fixture.approveWork("one", "board-one-changed");
			yield* prepareWork("dependent");
			yield* prepareWork("two");
			const fleet = yield* Fleet;
			expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "FleetFailure", reason: "denied" });
			expect((yield* fleet.get("dependent")).value.blocker).toContain("board-one-changed");
			expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
			yield* prepareWork("one");
			expect((yield* acceptDependency(fixture)).value.stage).toBe("completed");
			expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
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
			expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
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
