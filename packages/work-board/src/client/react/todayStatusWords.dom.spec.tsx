import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
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
	"shows authored words on work cards and keeps all five states in Library's filter",
	[routedScreen(files, "/_board/library")],
	function* ({ roles, readText, findElements }) {
		yield* eventually(() => expect(readText("main")).toContain("Ready brief"));
		expect(
			findElements("main li p")
				.map((entry) => entry.textContent)
				.sort(),
		).toEqual(["Task · Deferred", "Task · Done", "Task · Draft", "Task · Dropped", "Task · Ready"]);
		yield* roles.click({ name: "Status", role: "combobox" });
		expect(findElements('[role="option"]', document).map((entry) => entry.textContent)).toEqual(
			expect.arrayContaining(["Draft", "Ready", "Done", "Deferred", "Dropped"]),
		);
		yield* roles.click({ name: "Deferred", role: "option" });
		yield* eventually(() => expect(findElements("main li p").map((entry) => entry.textContent)).toEqual(["Task · Deferred"]));
	},
);
