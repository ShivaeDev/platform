import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";

const PLANNED =
	'---\nid: goal.admin\nkind: project\nstatus: planned\nowner: Casey\nnext_action: "Later: design the admin system"\n---\n# Admin system\n';

boardStory.it(
	"moves person-owned work from Needs you to the collapsed Later list once it is deferred",
	[projectFiles({ "goals/admin.md": PLANNED }, "a person owns planned work with a next action")],
	function* ({ editFile, page, reader }) {
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
		expect(reader.todayRows("Needs you")).toEqual([{ detail: "Casey: Later: design the admin system", title: "Admin system" }]);
		expect(page.document.getElementById("later")).toBeNull();
		editFile("goals/admin.md", PLANNED.replace("status: planned", "status: deferred"));
		yield* Effect.promise(() =>
			waitFor(() => expect(reader.todayRows("Later")).toEqual([{ detail: "Later: design the admin system", title: "Admin system" }])),
		);
		expect(reader.todayRows("Needs you")).toEqual([]);
		expect(page.document.getElementById("inbox-count")?.textContent).toBe("0");
		expect(page.document.querySelector("#later summary")?.textContent).toBe("Later1");
		expect(page.document.querySelector("#later details")?.hasAttribute("open")).toBe(false);
	},
);
