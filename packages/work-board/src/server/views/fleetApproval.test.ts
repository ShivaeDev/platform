import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

for (const [approval, approved] of [
	["approved", true],
	['"approved"', true],
	["held", false],
	["manual", false],
] as const) {
	boardStory.it(
		`a task with fleet: ${approval} ${approved ? "is" : "is not"} approved for Fleet on Work`,
		[projectFiles({ "task.md": `---\nid: task\nkind: task\nstatus: draft\nfleet: ${approval}\n---\n# Task` })],
		function* ({ workItem }) {
			expect(yield* workItem("task")).toMatchObject({ fleetApproved: approved });
		},
	);
}
