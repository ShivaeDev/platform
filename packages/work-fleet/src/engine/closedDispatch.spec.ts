import { Effect } from "effect";
import { expect } from "vitest";
import { cycle } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { mainObservation } from "#test/preparation.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = postgresTests("test", "isolated");

for (const status of ["done", "superseded", "deferred"]) {
	test(`an area waiter closed as ${status} is released without starting a worker`, () =>
		withFleetBoard({ noChange: true }, (fixture, root, source) =>
			Effect.gen(function* () {
				const files = boardHttpFiles(root);
				const planned = source.replace("kind: task", "kind: task\nstatus: planned\nareas: [shared]");
				files.write("one.md", planned);
				files.write("two.md", planned.replace("id: one", "id: two"));
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				yield* cycle;
				expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area shared held by one");
				files.write("two.md", planned.replace("id: one", "id: two").replace("status: planned", `status: ${status}`));
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				const starts = fixture.starts.length;
				yield* cycle;
				expect(fixture.starts).toHaveLength(starts);
				expect((yield* fleet.get("two")).value).toMatchObject({
					attempts: [],
					releaseReason: `Not launched because current Board status is ${status}`,
					stage: "released",
				});
				const waiting = views((yield* fleet.list()).map(({ value }) => value)).waiting;
				expect(Object.values(waiting).flat()).toEqual([]);
				expect((yield* fixture.restart(cycle)).dispatched).toEqual([]);
				expect(fixture.starts).toHaveLength(starts);
			}),
		));

	test(`a dependency waiter closed as ${status} is dropped when its dependency completes`, () =>
		withEngine({ noChange: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* prepareWork("dependent");
				const fleet = yield* Fleet;
				yield* cycle;
				expect((yield* fleet.get("dependent")).value.blocker).toContain("waiting for dependency one");
				fixture.boardStatus("dependent", status);
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				const starts = fixture.starts.length;
				yield* fixture.restart(cycle);
				expect((yield* fleet.get("dependent")).value.stage).toBe("released");
				expect(fixture.starts).toHaveLength(starts);
			}),
		));
}

test("launch rechecks status after dispatch assesses preparation", () => {
	let closeWork: (() => void) | undefined;
	return withEngine(
		{
			mainQuery: (preparation) => Effect.sync(() => closeWork?.()).pipe(Effect.as(mainObservation({ fromRevision: preparation.baseRevision }))),
		},
		(fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				closeWork = () => fixture.boardStatus("one", "superseded");
				const fleet = yield* Fleet;
				expect((yield* fleet.dispatch("one")).value.stage).toBe("released");
				expect(fixture.starts).toEqual([]);
			}),
	);
});
