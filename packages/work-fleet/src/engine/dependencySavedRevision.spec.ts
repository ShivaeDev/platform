import { Effect } from "effect";
import { expect } from "vitest";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { Fleet } from "#fleet.ts";
import { acceptDependency } from "#test/acceptDependency.ts";
import { dependencySource, withDependencyBoard } from "#test/dependencyBoard.ts";
import { prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

for (const noChange of [false, true]) {
	for (const [field, source, accepted] of [
		["status", dependencySource.replace("status: planned", "status: done"), true],
		["next_action", dependencySource.replace("Implement the work.", "Work completed."), true],
		["criteria", dependencySource.replace("The behavior works.", "Different behavior."), false],
		["body", `${dependencySource}\nDifferent body.\n`, false],
	] as const) {
		test(`a saved whole-file ${noChange ? "no-change" : "merge"} outcome ${accepted ? "survives" : "blocks after"} a ${field} edit`, () =>
			withDependencyBoard({ noChange }, (fixture, write) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					const completed = (yield* acceptDependency(fixture)).value;
					const saved = { ...completed, boardRevision: revisionOf(dependencySource) };
					yield* fixture.replaceRecord(saved);
					write(source);
					yield* prepareWork("dependent");
					const dispatched = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.dispatch("dependent").pipe(Effect.result))));
					expect(dispatched._tag).toBe(accepted ? "Success" : "Failure");
					expect((yield* fleet.get("dependent")).value.stage).toBe(accepted ? "executing" : "prepared");
					expect((yield* fleet.get("one")).value).toEqual(saved);
				}),
			));
	}
}
