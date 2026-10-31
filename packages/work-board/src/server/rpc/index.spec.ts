import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { indexClientSubscribed, liveClientSubscribed } from "#test/liveTraits.ts";

const brief = projectFiles({ "brief.md": "---\nid: brief\nkind: task\n---\n# Before" });

boardStory.it("the Board index lists each Markdown file with its parsed fields and body", [brief], function* ({ indexEntry, indexListing }) {
	yield* outcomes([
		["the brief", () => indexEntry("brief.md"), { body: "# Before", fields: { id: "brief", kind: "task" }, problems: [] }],
		["the indexed files", () => indexListing(), ["brief.md"]],
	]);
});

boardStory.it(
	"a client subscribed to the Board index alone hears an edit as a workspace index change",
	[brief, indexClientSubscribed],
	function* ({ editFile, nextChange }) {
		editFile("brief.md", "---\nid: brief\nkind: task\n---\n# After");

		expect(yield* nextChange()).toEqual(["workspace index"]);
	},
);

boardStory.it(
	"after an edit to invalid metadata the Board index shows the new body, flags the kind and keeps no fields",
	[brief, liveClientSubscribed],
	function* ({ changeNaming, editFile, indexEntry }) {
		editFile("brief.md", "---\nid: brief\nkind: invalid\n---\n# After");
		yield* changeNaming("brief.md");

		expect(yield* indexEntry("brief.md")).toEqual({ body: "# After", fields: {}, problems: ["kind"] });
	},
);

boardStory.it("an edit raises the Board index revision", [brief, liveClientSubscribed], function* ({ changeNaming, editFile, indexRevision }) {
	const before = yield* indexRevision();

	editFile("brief.md", "---\nid: brief\nkind: task\n---\n# After");
	yield* changeNaming("brief.md");

	expect(yield* indexRevision()).toBeGreaterThan(before);
});
