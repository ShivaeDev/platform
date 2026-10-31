import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const tasks = projectFiles({
	"missing.md": "---\nid: missing\nkind: task\n---\n# No owner",
	"owned.md": "---\nid: owned\nkind: task\nowner: marvin\n---\n# Owned task",
});

for (const [filter, url, rows] of [
	["the missing owner", "/_board/work?view=table&owner=missing", ["missing"]],
	["the owner value marvin", "/_board/work?view=table&owner=value%3Amarvin", ["owned"]],
] as const) {
	boardStory.it(`filtering Work by ${filter} lists only ${rows.join(", ")}`, [tasks], function* ({ workRowIds }) {
		expect(yield* workRowIds(url)).toEqual(rows);
	});
}

boardStory.it("an item selected outside the owner filter stays selected and is marked as outside it", [tasks], function* ({ workSelection }) {
	expect(yield* workSelection("/_board/work?view=table&owner=value%3Amarvin&item=missing")).toEqual({ file: "missing.md", outsideFilter: true });
});

boardStory.it("an unknown view and sort fall back to Now and title, and a 500-character search keeps 200", [tasks], function* ({ workState }) {
	expect(yield* workState(`/_board/work?view=unknown&sort=mtime&q=${"a".repeat(500)}`)).toMatchObject({
		query: "a".repeat(200),
		sort: "title",
		view: "now",
	});
});
