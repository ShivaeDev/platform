import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const identified = projectFiles(
	{
		"_board/item/missing.md": "# Unidentified file",
		"_board/item/source.md": "# Colliding file",
		"identified.md": "---\nid: source.md\n---\n# Identified item",
	},
	"identified.md declares the ID source.md, while _board/item/source.md and _board/item/missing.md are plain files under the item route",
);

for (const url of ["/_board/item/source.md", "/_board/item/source.md/", "/_board/item/source%2Emd", "/_board/item/source%2Emd/"]) {
	boardStory.it(
		`the item URL ${url} serves the item identified as source.md, not the file at that path`,
		[identified],
		function* ({ itemRead, statusOf }) {
			yield* outcomes([
				["item", () => itemRead(url), { file: "identified.md", identity: "source.md", source: "# Identified item" }],
				["page", () => statusOf(url), "OK"],
			]);
		},
	);
}

for (const url of ["/_board/item/source.md", "/_board/item/source.md/", "/_board/item/source%2Emd"]) {
	boardStory.it(`a live read of ${url} shows the identified item's edit`, [identified], function* ({ editFile, nextItemSource, watchItem }) {
		expect(yield* watchItem(url)).toBe("# Identified item");

		editFile("identified.md", "---\nid: source.md\n---\n# Changed stable identity");

		expect(yield* nextItemSource(url)).toBe("# Changed stable identity");
	});
}

for (const url of ["/_board/item/missing.md", "/_board/item/missing.md/"]) {
	boardStory.it(`the item URL ${url}, naming a plain file rather than an ID, answers Not Found`, [identified], function* ({ itemRead, statusOf }) {
		yield* outcomes([
			["item", () => itemRead(url), "not found"],
			["page", () => statusOf(url), "Not Found"],
		]);
	});
}
