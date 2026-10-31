import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { directoryReadsRecorded, watchBlind, workspaceLink } from "#test/servingStoryTraits.ts";
import { outsideFiles } from "#test/servingTraits.ts";

const OUTSIDE = "# Outside the folder\n";
const workspace = [
	projectFiles({
		".drafts/hidden.md": "# Hidden\n",
		"node_modules/pkg/readme.md": "# Dependency\n",
		"notes/log.md": "# Log\n",
		"notes/raw.txt": "plain\n",
		"plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n",
	}),
	boardHome("plan.md"),
	outsideFiles({ "private.md": OUTSIDE }),
];

boardStory.it("the library lists only Markdown files outside dot folders and node_modules", workspace, function* ({ libraryPaths }) {
	expect(yield* libraryPaths()).toEqual(["/notes/log.md", "/plan.md"]);
});

for (const [path, kind] of [
	["/.drafts/hidden.md", "a file in a dot folder"],
	["/node_modules/pkg/readme.md", "a file in node_modules"],
	["/notes/raw.txt", "a file that is not Markdown"],
	["/%E0%A4%A.md", "a path that is not valid percent-encoding"],
] as const) {
	boardStory.it(`${path}, ${kind}, answers Not Found`, workspace, function* ({ statusOf }) {
		expect(yield* statusOf(path)).toBe("Not Found");
	});
}

boardStory.it(
	"listing the workspace never visits dot folders or node_modules",
	[...workspace, directoryReadsRecorded],
	function* ({ libraryPaths, visitedPaths }) {
		yield* libraryPaths();

		expect(yield* visitedPaths()).toEqual(["", "notes", "notes/log.md", "notes/raw.txt", "plan.md"]);
	},
);

boardStory.it("a path that climbs out of the workspace answers Not Found without the outside file", workspace, function* ({ download, outside }) {
	expect(yield* download(`/..%2f${outside.root.split("/").at(-1)}%2fprivate.md`)).toMatchObject({
		status: "Not Found",
		text: expect.not.stringContaining(OUTSIDE),
	});
});

boardStory.it(
	"a folder linked into the workspace from outside is listed and served",
	[...workspace, workspaceLink("notes/elsewhere", "the outside folder")],
	function* ({ libraryPaths, statusOf }) {
		yield* outcomes([
			["library", () => libraryPaths(), expect.arrayContaining(["/notes/elsewhere/private.md"])],
			["page", () => statusOf("/notes/elsewhere/private.md"), "OK"],
		]);
	},
);

boardStory.it(
	"a file link to another workspace file is listed and served",
	[...workspace, workspaceLink("notes/alias.md", "plan.md")],
	function* ({ libraryPaths, statusOf }) {
		yield* outcomes([
			["library", () => libraryPaths(), expect.arrayContaining(["/notes/alias.md"])],
			["page", () => statusOf("/notes/alias.md"), "OK"],
		]);
	},
);

for (const [path, link, target] of [
	["/leak.md", "leak.md", "the outside file"],
	["/up/<outside>/private.md", "up", "the parent folder"],
] as const) {
	boardStory.it(
		`a link to ${target} is neither listed nor served`,
		[...workspace, workspaceLink(link, target)],
		function* ({ download, libraryPaths, outside }) {
			yield* outcomes([
				["library", () => libraryPaths(), ["/notes/log.md", "/plan.md"]],
				[
					"page",
					() => download(path.replace("<outside>", outside.root.split("/").at(-1) ?? "")),
					expect.objectContaining({ status: "Not Found", text: expect.not.stringContaining(OUTSIDE) }),
				],
			]);
		},
	);
}

boardStory.it(
	"a listed file replaced by a link to an outside file answers Not Found before the watcher notices",
	[...workspace, watchBlind],
	function* ({ download, replaceWithLink }) {
		expect(yield* download("/notes/log.md")).toMatchObject({ status: "OK" });

		replaceWithLink("notes/log.md", "the outside file");

		expect(yield* download("/notes/log.md")).toMatchObject({ status: "Not Found", text: expect.not.stringContaining(OUTSIDE) });
	},
);

boardStory.it(
	"a file named c# & more?.md is listed under its encoded path and served there",
	[...workspace, projectFiles({ "notes/c# & more?.md": "# Sharp\n" })],
	function* ({ libraryPaths, statusOf }) {
		yield* outcomes([
			["library", () => libraryPaths(), expect.arrayContaining(["/notes/c%23%20%26%20more%3F.md"])],
			["page", () => statusOf("/notes/c%23%20%26%20more%3F.md"), "OK"],
		]);
	},
);

boardStory.it(
	"a listed file the board cannot read answers Internal Server Error with the board's shell",
	workspace,
	function* ({ pageShell, permissions }) {
		permissions("notes/log.md", 0o000);

		expect(yield* pageShell("/notes/log.md")).toMatchObject({ skeleton: ["aside", "header", "nav"], status: "Internal Server Error" });
	},
);

boardStory.it("repeated page requests reuse the folder listing", [...workspace, directoryReadsRecorded], function* ({ folderListings, statusOf }) {
	yield* statusOf("/notes/log.md");
	const listed = yield* folderListings("notes");

	yield* statusOf("/");
	yield* statusOf("/notes/log.md");

	expect(yield* folderListings("notes")).toBe(listed);
});

boardStory.it(
	"a file added while the board watches is listed without listing its folder again",
	[...workspace, directoryReadsRecorded],
	function* ({ folderListings, libraryPaths, writeWatched }) {
		yield* libraryPaths();
		const listed = yield* folderListings("notes");

		yield* writeWatched("notes/new.md", "# New\n");

		yield* outcomes([
			["library", () => libraryPaths(), expect.arrayContaining(["/notes/new.md"])],
			["listings of notes", () => folderListings("notes"), listed],
		]);
	},
);

boardStory.it("the page shell allows only the board's own scripts and forbids MIME sniffing", workspace, function* ({ download }) {
	expect(yield* download("/")).toMatchObject({
		contentSecurityPolicy: expect.stringMatching(/default-src 'self'.*script-src 'self' 'wasm-unsafe-eval';/u),
		sniffing: "refused",
	});
});

boardStory.it("the browser client is served as JavaScript from the package's built React bundle", workspace, function* ({ builtAsset, download }) {
	const bundle = yield* builtAsset("react.js");

	expect(yield* download("/_board/react.js")).toMatchObject({ status: "OK", text: bundle, type: "text/javascript" });
});

boardStory.it("Mermaid's entry module is served as JavaScript from the installed package", workspace, function* ({ download }) {
	expect(yield* download("/_board/mermaid/mermaid.esm.min.mjs")).toMatchObject({ status: "OK", type: "text/javascript" });
});

boardStory.it("a path that climbs out of Mermaid's package answers Not Found", workspace, function* ({ statusOf }) {
	expect(yield* statusOf("/_board/mermaid/..%2f..%2fpackage.json")).toBe("Not Found");
});
