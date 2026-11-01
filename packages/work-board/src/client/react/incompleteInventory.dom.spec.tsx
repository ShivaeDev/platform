import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { incompleteInventory } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen, systemScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

for (const route of ["/_board/work", "/_board/goals"]) {
	screenStory.it(
		`${route} names unreadable directories instead of claiming empty membership`,
		[
			screenFiles({ "task.md": "---\nid: task.one\nkind: task\nstatus: draft\n---\n# Task" }),
			incompleteInventory(["hidden"]),
			screenRoute(route),
			openScreen(),
		],
		function* ({ read }) {
			const screen = yield* read();

			expect(screen.text).toContain("Workspace index incomplete; could not read hidden.");
			expect(screen.text).not.toContain("No work yet");
			expect(screen.text).not.toContain("No active goals");
		},
	);
}

screenStory.it(
	"System keeps the Fleet execution ID and stage visible and names the incomplete document join",
	[
		systemScreen({
			completed: [],
			items: [{ document: null, stage: "working", stageEnteredAt: 0, updatedAt: 0, workId: "task.one" }],
			state: "ready",
			unavailable: ["hidden"],
		}),
	],
	function* ({ read }) {
		const screen = yield* read();

		expect(screen.text).toContain("Workspace index incomplete; could not read hidden.");
		expect(screen.text).toContain("task.one");
		expect(screen.text).toContain("Working");
	},
);

screenStory.it(
	"Library names an unreadable directory and qualifies its document list",
	[screenFiles({ "note.md": "# Readable inventory note" }), incompleteInventory(["hidden"]), screenRoute("/_board/library"), openScreen()],
	function* ({ read }) {
		const screen = yield* read();

		expect(screen.text).toContain("Workspace index incomplete; could not read hidden.");
		expect(screen.text).toContain("Readable inventory note");
		expect(screen.text).not.toContain("Every document in this workspace.");
	},
);
