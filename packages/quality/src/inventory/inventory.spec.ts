import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { folderBlocked, inventoryStory, repositoryHas, repositoryLinks, runsAsRoot } from "#test/inventoryStory.ts";

const APP = { content: "a\nb\n", path: "src/app.ts" };
const VIEW = { content: "<p/>\n", path: "src/view.tsx" };
const NOTES = { content: "# Notes\n", path: "docs/notes.md" };
const ROUTES = { content: "export const route = 1;\n", path: "src/routes/tree.gen.ts" };
const TOOL = { content: "export {};\n", path: "scripts/tool.ts" };

const repository = repositoryHas(APP, VIEW, NOTES, ROUTES, TOOL);

inventoryStory.it(
	"the inventory lists every file in path order and reads the sources with the configured extensions line by line",
	[repository],
	function* ({ collects, files, source, sourcePaths }) {
		yield* collects({ extensions: [".ts", ".tsx"] });

		yield* outcomes([
			["files", () => files(), ["docs/notes.md", "scripts/tool.ts", "src/app.ts", "src/routes/tree.gen.ts", "src/view.tsx"]],
			["source of src/app.ts", () => source("src/app.ts"), { lines: ["a", "b"], path: "src/app.ts", text: "a\nb\n" }],
			["sources", () => sourcePaths(), ["scripts/tool.ts", "src/app.ts", "src/routes/tree.gen.ts", "src/view.tsx"]],
		]);
	},
);

inventoryStory.it(
	"the inventory walks only the configured sources, single files among them, and lists a file named twice once",
	[repository],
	function* ({ collects, files }) {
		yield* collects({ sources: ["src", "scripts/tool.ts", "src", "src/app.ts"] });

		expect(yield* files()).toEqual(["scripts/tool.ts", "src/app.ts", "src/routes/tree.gen.ts", "src/view.tsx"]);
	},
);

const UNICODE = [
	"src/.ts",
	"src/😀.ts",
	"src/𐀀.ts",
	"src/á.ts",
	"src/é.ts",
	"src/aa.ts",
	"src/a2.ts",
	"src/a10.ts",
	"src/a.ts",
	"src/Z.ts",
	"src/B.ts",
];

inventoryStory.it(
	"the inventory orders paths by UTF-16 code units, not by locale or code points",
	[repositoryHas(...UNICODE.map((path) => ({ content: path, path })))],
	function* ({ collects, files }) {
		yield* collects();

		expect(yield* files()).toEqual([
			"src/B.ts",
			"src/Z.ts",
			"src/a.ts",
			"src/a10.ts",
			"src/a2.ts",
			"src/aa.ts",
			"src/é.ts",
			"src/á.ts",
			"src/𐀀.ts",
			"src/😀.ts",
			"src/.ts",
		]);
	},
);

inventoryStory.it("the inventory leaves out excluded paths written in .gitignore syntax", [repository], function* ({ collects, files }) {
	yield* collects({ exclude: ["*.gen.ts", "docs/"] });

	expect(yield* files()).toEqual(["scripts/tool.ts", "src/app.ts", "src/view.tsx"]);
});

const refusedSources = [
	["srcc", 'source "srcc" does not exist'],
	["../elsewhere", 'source "../elsewhere" lies outside the repository'],
] as const;

for (const [configured, reason] of refusedSources) {
	inventoryStory.it(`the inventory fails because the configured ${reason}`, [repository], function* ({ collects, failure }) {
		yield* collects({ sources: [configured] });

		expect(yield* failure()).toContain(reason);
	});
}

inventoryStory.it("the walk finds nothing in a folder that does not exist", [], function* ({ walks }) {
	expect(yield* walks("missing")).toEqual([]);
});

inventoryStory.it(
	"the walk passes a link to a missing file and collects the files that remain",
	[repositoryHas({ content: "export const value = 1;", path: "present.ts" }), repositoryLinks("dangling.ts", "missing-target")],
	function* ({ walks }) {
		expect(yield* walks(".")).toEqual(["present.ts"]);
	},
);

inventoryStory.it.skipIf(runsAsRoot)(
	"the walk fails on a folder git may not enter and names it",
	[folderBlocked("packages")],
	function* ({ failure, walks }) {
		yield* walks("packages");

		expect(yield* failure()).toMatch(/^cannot run git in packages: /u);
	},
);
