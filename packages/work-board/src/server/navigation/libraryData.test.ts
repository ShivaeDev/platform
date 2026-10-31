import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { modifiedNotes } from "#test/readingTraits.ts";

const MODIFIED = 1_700_000_000_000;
const library = [
	projectFiles({
		"nested/slug.md": "---\nid: notes.slug\nkind: task\nstatus: ready\n---\n# A readable title\n",
		"receipt.md": `---\nkind: report\nrequest_receipt:\n question: request\n disposition: superseded\n recordedAt: 0\n reviewedRevision: ${"a".repeat(64)}\n---\n# Receipt\n`,
	}),
	modifiedNotes(new Map([["nested/slug.md", MODIFIED]])),
];

boardStory.it("the library lists a document with its indexed title, kind, status and modification time", library, function* ({ libraryRow }) {
	expect(yield* libraryRow("nested/slug.md")).toMatchObject({
		href: "/nested/slug.md",
		kind: "task",
		modified: MODIFIED,
		status: "ready",
		title: "A readable title",
	});
});

boardStory.it("a Fleet receipt is counted but only listed once Fleet files are shown", library, function* ({ libraryResult }) {
	yield* outcomes({
		"fleet files hidden": [libraryResult({}), expect.objectContaining({ fleetCount: 1, paths: ["nested/slug.md"] })],
		"fleet files shown": [libraryResult({ showFleet: true }), expect.objectContaining({ paths: ["nested/slug.md", "receipt.md"] })],
	});
});

boardStory.it("the root folder lists its subfolders with their counts and no nested file", library, function* ({ libraryResult }) {
	expect(yield* libraryResult({ folder: "" })).toMatchObject({ folders: [{ count: 1, name: "nested", path: "nested" }], paths: [] });
});

for (const [filter, input, paths] of [
	["its folder, kind and status", { folder: "nested", kind: "task", status: "ready" }, ["nested/slug.md"]],
	["title words in any case", { query: "TITLE readable" }, ["nested/slug.md"]],
	["its ID", { query: "notes.slug" }, ["nested/slug.md"]],
	["words that only a hidden receipt matches", { query: "readable receipt" }, []],
] as const) {
	boardStory.it(
		`filtering the library by ${filter} lists ${paths.length === 0 ? "nothing" : paths.join(", ")}`,
		library,
		function* ({ libraryResult }) {
			expect(yield* libraryResult(input)).toMatchObject({ paths });
		},
	);
}
