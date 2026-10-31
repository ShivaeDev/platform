import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"a Markdown reference link counts as a backlink, while links in code and section anchors do not",
	[
		projectFiles({
			"evidence.md": "# Evidence",
			"fake.md": "# Fake",
			"nested/note.md":
				"# Heading\n\n[Real link][record]\n\n[record]: ../evidence.md#heading-observation\n\n`[Fake](../fake.md)`\n\n```md\n[Also fake](../fake.md)\n```\n\n[Passage](#heading-one)\n",
		}),
	],
	function* ({ documentBacklinks }) {
		yield* outcomes({
			"backlinks of evidence.md": [documentBacklinks("evidence.md"), ["/nested/note.md"]],
			"backlinks of fake.md": [documentBacklinks("fake.md"), []],
		});
	},
);

boardStory.it(
	"two cards on the home board using the same reference link give the target one backlink",
	[
		projectFiles({
			"home.md": "# Home\n\n## To read\n\n### One\n\n[Record][record]\n\n### Two\n\n[Record][record]\n\n[record]: notes/evidence.md\n",
			"notes/evidence.md": "# Evidence",
		}),
		boardHome("home.md"),
	],
	function* ({ documentBacklinks }) {
		expect(yield* documentBacklinks("notes/evidence.md")).toEqual(["/home.md"]);
	},
);
