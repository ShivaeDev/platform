import { Effect } from "effect";
import { expect } from "vitest";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { dependencySource } from "#test/dependencyBoard.ts";
import { authoredBoardWork } from "#test/engineBoardTraits.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork, noChangeReported } from "#test/engineTraits.ts";

for (const noChange of [false, true]) {
	for (const [field, source] of [
		["unchanged source", dependencySource],
		["status", dependencySource.replace("status: planned", "status: done")],
		["next_action", dependencySource.replace("Implement the work.", "Work completed.")],
	] as const) {
		engine.it(
			`completed legacy ${noChange ? "no-change" : "merge"} work rejects preparation after ${field} and retains its outcome`,
			[markdownWork(), authoredBoardWork(dependencySource), noChangeReported(noChange)],
			function* (fleet) {
				yield* fleet.prepareWork("one");
				yield* fleet.dispatch("one");
				fleet.finishWorkers();
				const completed = (yield* fleet.reconcile("one")).value;
				expect(completed.stage).toBe("completed");
				expect(completed.outcome).toBeDefined();
				const saved = { ...completed, boardRevision: revisionOf(dependencySource) };
				yield* fleet.replaceStoredRecord(saved);
				const before = yield* fleet.get("one");
				fleet.writeBoardWork("one.md", source);
				yield* fleet.restart();
				const denied = yield* fleet.prepareWork("one").pipe(Effect.result);
				expect(denied).toMatchObject({
					_tag: "Failure",
					failure: { _tag: "Forbidden", message: "Completed work needs a newly approved Board context before renewal" },
				});
				expect(yield* fleet.get("one")).toEqual(before);
			},
		);
	}
	for (const [field, source] of [
		["criteria", dependencySource.replace("The behavior works.", "Different behavior.")],
		["body", `${dependencySource}\nDifferent body.\n`],
	] as const) {
		engine.it(
			`completed legacy ${noChange ? "no-change" : "merge"} work renews after a ${field} edit and archives its accepted outcome`,
			[markdownWork(), authoredBoardWork(dependencySource), noChangeReported(noChange)],
			function* (fleet) {
				yield* fleet.prepareWork("one");
				yield* fleet.dispatch("one");
				fleet.finishWorkers();
				const completed = (yield* fleet.reconcile("one")).value;
				expect(completed.stage).toBe("completed");
				expect(completed.outcome).toBeDefined();
				const saved = { ...completed, boardRevision: revisionOf(dependencySource) };
				yield* fleet.replaceStoredRecord(saved);
				fleet.writeBoardWork("one.md", source);
				yield* fleet.restart();
				const renewed = yield* fleet.prepareWork("one");
				expect(renewed.value.stage).toBe("prepared");
				expect(renewed.value.boardContext).toBe(source);
				expect(renewed.value.boardRevision).toBe(briefRevision(metadataParse(source)));
				expect(renewed.value.outcome).toBeUndefined();
				expect(renewed.value.history).toMatchObject([{ boardRevision: saved.boardRevision, outcome: saved.outcome }]);
			},
		);
	}
}
