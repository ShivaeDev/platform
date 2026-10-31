import { expect } from "vitest";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { dependencySource } from "#test/dependencyBoard.ts";
import { dependencyMarkdown } from "#test/dependencyMarkdown.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork, noChangeReported } from "#test/engineTraits.ts";
import { refusal } from "#test/refusal.ts";

for (const noChange of [false, true]) {
	for (const [field, source, sameBrief] of [
		["status", dependencySource.replace("status: draft", "status: done"), true],
		["next_action", dependencySource.replace("Implement the work.", "Work completed."), true],
		["criteria", dependencySource.replace("The behavior works.", "Different behavior."), false],
		["body", `${dependencySource}\nDifferent body.\n`, false],
	] as const) {
		const accepted = !noChange || sameBrief;
		engine.it(
			`a saved whole-file ${noChange ? "no-change" : "merge"} outcome ${accepted ? "survives" : "blocks after"} a ${field} edit`,
			[markdownWork(), dependencyMarkdown(), noChangeReported(noChange)],
			function* ({ fleet, prepareWork, finishWorkers, replaceStoredRecord, writeBoardWork, restart, stepOf }) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers();
				const completed = (yield* fleet.reconcile("one")).value;
				const saved = { ...completed, boardRevision: revisionOf(dependencySource), mergedDelivery: undefined };
				yield* replaceStoredRecord(saved);
				writeBoardWork("one.md", source);
				yield* prepareWork("dependent");
				yield* restart();

				const dispatched = yield* refusal(fleet.dispatch("dependent"));

				expect(dispatched).toEqual(accepted ? "accepted" : expect.stringMatching(/^forbidden: /u));
				expect(yield* stepOf("dependent")).toBe(accepted ? "working" : "queued");
				const one = yield* fleet.get("one");
				expect(one.value).toEqual(saved);
			},
		);
	}
}
