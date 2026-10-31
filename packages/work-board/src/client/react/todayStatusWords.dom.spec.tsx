import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const files = {
	"deferred.md": "---\nid: task.deferred\nkind: task\nstatus: deferred\nnext_action: Reopen with API approval\n---\n# Parked brief",
	"done.md": "---\nid: task.done\nkind: task\nstatus: done\n---\n# Delivered brief",
	"draft.md": "---\nid: task.draft\nkind: task\nstatus: draft\n---\n# Draft brief",
	"dropped.md": "---\nid: task.dropped\nkind: task\nstatus: dropped\n---\n# Dropped brief",
	"ready.md": "---\nid: task.ready\nkind: task\nstatus: ready\n---\n# Ready brief",
};

screenStory.it(
	"a Library row names a task's authored state in the Board's words",
	[routedScreen(files, "/_board/library")],
	function* ({ libraryRow }) {
		yield* outcomes({
			deferred: [libraryRow("Parked brief"), expect.objectContaining({ details: "Task · Deferred" })],
			done: [libraryRow("Delivered brief"), expect.objectContaining({ details: "Task · Done" })],
			draft: [libraryRow("Draft brief"), expect.objectContaining({ details: "Task · Draft" })],
			dropped: [libraryRow("Dropped brief"), expect.objectContaining({ details: "Task · Dropped" })],
			ready: [libraryRow("Ready brief"), expect.objectContaining({ details: "Task · Ready" })],
		});
	},
);

screenStory.it(
	"choosing Deferred in the Library's Status filter lists only deferred work",
	[routedScreen(files, "/_board/library")],
	function* ({ filterLibrary, libraryTitles }) {
		expect(yield* libraryTitles()).toEqual(expect.arrayContaining(["Delivered brief", "Parked brief", "Ready brief"]));

		yield* filterLibrary("Status", "Deferred");

		expect(yield* libraryTitles()).toEqual(["Parked brief"]);
	},
);
