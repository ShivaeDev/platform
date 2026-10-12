import { Effect } from "effect";
import { expect } from "vitest";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { Fleet } from "#fleet.ts";
import { acceptDependency } from "#test/acceptDependency.ts";
import { dependencySource, withDependencyBoard } from "#test/dependencyBoard.ts";
import { prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

for (const noChange of [false, true]) {
	for (const [field, source] of [
		["unchanged source", dependencySource],
		["status", dependencySource.replace("status: planned", "status: done")],
		["next_action", dependencySource.replace("Implement the work.", "Work completed.")],
	] as const) {
		test(`completed legacy ${noChange ? "no-change" : "merge"} work rejects preparation after ${field} and retains its outcome`, () =>
			withDependencyBoard({ noChange }, (fixture, write) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					const completed = (yield* acceptDependency(fixture)).value;
					expect(completed.stage).toBe("completed");
					expect(completed.outcome).toBeDefined();
					const saved = { ...completed, boardRevision: revisionOf(dependencySource) };
					yield* fixture.replaceRecord(saved);
					const before = yield* fleet.get("one");
					write(source);
					const denied = yield* fixture.restart(prepareWork("one").pipe(Effect.result));
					expect(denied).toMatchObject({
						_tag: "Failure",
						failure: { _tag: "Forbidden", message: "Completed work needs a newly approved Board context before renewal" },
					});
					expect(yield* fleet.get("one")).toEqual(before);
				}),
			));
	}
	for (const [field, source] of [
		["criteria", dependencySource.replace("The behavior works.", "Different behavior.")],
		["body", `${dependencySource}\nDifferent body.\n`],
	] as const) {
		test(`completed legacy ${noChange ? "no-change" : "merge"} work renews after a ${field} edit and archives its accepted outcome`, () =>
			withDependencyBoard({ noChange }, (fixture, write) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const completed = (yield* acceptDependency(fixture)).value;
					expect(completed.stage).toBe("completed");
					expect(completed.outcome).toBeDefined();
					const saved = { ...completed, boardRevision: revisionOf(dependencySource) };
					yield* fixture.replaceRecord(saved);
					write(source);
					const renewed = yield* fixture.restart(prepareWork("one"));
					expect(renewed.value.stage).toBe("prepared");
					expect(renewed.value.boardContext).toBe(source);
					expect(renewed.value.boardRevision).toBe(briefRevision(metadataParse(source)));
					expect(renewed.value.outcome).toBeUndefined();
					expect(renewed.value.history).toMatchObject([{ boardRevision: saved.boardRevision, outcome: saved.outcome }]);
				}),
			));
	}
}
