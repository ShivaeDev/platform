import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { unavailableBriefValidation } from "#test/unavailableBriefValidation.ts";
import { briefRefusingFleet } from "#test/workspaceBoardTraits.ts";

const source = projectFiles({ "task.md": "---\nid: task.one\nkind: task\nstatus: ready\n---\n# Task\n" });

boardStory.it(
	"a failed Fleet brief check is unavailable in document diagnostics",
	[source, unavailableBriefValidation()],
	function* ({ itemDiagnostics }) {
		expect(yield* itemDiagnostics("/task.md")).toEqual([
			{ field: "id", line: 2, message: "Fleet brief validation is unavailable; this brief has not been checked." },
		]);
	},
);

boardStory.it("an accepted Fleet brief has no validation diagnostic", [source, briefRefusingFleet({})], function* ({ itemDiagnostics }) {
	expect(yield* itemDiagnostics("/task.md")).toEqual([]);
});

boardStory.it(
	"Fleet items are unavailable when their brief checks fail",
	[source, unavailableBriefValidation({ completed: [], items: [{ stage: "working", stageEnteredAt: 100, updatedAt: 200, workId: "task.one" }] })],
	function* ({ fleetWork }) {
		expect(yield* fleetWork()).toEqual({
			authored: [{ file: "task.md", status: "ready", title: "Task", workId: "task.one" }],
			reason: "Fleet brief validation is unavailable; these briefs have not been checked.",
			state: "unavailable",
		});
	},
);
