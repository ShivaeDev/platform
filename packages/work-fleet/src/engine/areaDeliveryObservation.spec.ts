import { Effect } from "effect";
import { expect } from "vitest";
import { Conflict, Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

test("delivery changes after the merge wait do not reclaim freed areas", () => {
	let now = 100;
	let changed = false;
	return withEngine(
		{
			areaMergeWaitMs: 5000,
			backlog: 3,
			deliveryQuery: () => (changed ? Effect.fail(new Forbidden({ message: "PR closed without merging" })) : Effect.succeed(undefined)),
			now: () => now,
		},
		(fixture) =>
			Effect.gen(function* () {
				for (const id of ["one", "two", "dependent"]) {
					fixture.dependencies(id, []);
					fixture.areas(id, ["fleet/host"]);
					yield* prepareWork(id);
				}
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				now += 5000;
				yield* fleet.dispatch("two");
				changed = true;
				const previous = yield* fleet.reconcile("one");
				expect(previous.value.mergeAreasReleased).toBe(true);
				expect(previous.value.decision?.reason).toBe("PR closed without merging");
				expect(previous.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
				changed = false;
				finishWorkers(fixture);
				const current = yield* fleet.reconcile("two");
				const decision = current.value.decision?.id ?? "missing";
				yield* fleet.resolve("two", decision, fixture.respond(decision, "release"));
				expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
			}),
	);
});

test("a PR that no longer has valid delivery evidence does not expire its area hold", () => {
	let now = 100;
	let changed = false;
	return withEngine(
		{
			areaMergeWaitMs: 5000,
			deliveryQuery: () => (changed ? Effect.fail(new Conflict({ message: "PR head moved" })) : Effect.succeed(undefined)),
			now: () => now,
		},
		(fixture) =>
			Effect.gen(function* () {
				fixture.areas("one", ["fleet/host"]);
				fixture.areas("two", ["fleet/host"]);
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				changed = true;
				now = 1000;
				expect((yield* fleet.reconcile("one")).value.mergeReadyAt).toBeUndefined();
				yield* fleet.dispatch("two").pipe(Effect.result);
				expect((yield* fleet.get("two")).value.blocker).toContain("held by one");
			}),
	);
});
