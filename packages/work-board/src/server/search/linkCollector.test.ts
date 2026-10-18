import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"collects Markdown reference links as backlinks without code or section anchors",
	[
		projectFiles({
			"evidence.md": "# Evidence",
			"fake.md": "# Fake",
			"nested/note.md":
				"# Heading\n\n[Real link][record]\n\n[record]: ../evidence.md#heading-observation\n\n`[Fake](../fake.md)`\n\n```md\n[Also fake](../fake.md)\n```\n\n[Passage](#heading-one)\n",
		}),
	],
	function* ({ readDocument }) {
		expect((yield* readDocument("evidence.md")).reading?.backlinks).toEqual(
			expect.arrayContaining([expect.objectContaining({ href: "/nested/note.md" })]),
		);
		expect((yield* readDocument("fake.md")).reading?.backlinks).toEqual([]);
	},
);

boardStory.it(
	"deduplicates repeated home-board reference links",
	[
		projectFiles({
			"home.md": "# Home\n\n## To read\n\n### One\n\n[Record][record]\n\n### Two\n\n[Record][record]\n\n[record]: notes/evidence.md\n",
			"notes/evidence.md": "# Evidence",
		}),
		boardHome("home.md"),
	],
	function* ({ readDocument }) {
		expect((yield* readDocument("notes/evidence.md")).reading?.backlinks).toEqual([expect.objectContaining({ href: "/home.md" })]);
	},
);
