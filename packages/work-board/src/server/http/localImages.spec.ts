import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { privateImageBesideWorkspace, workspaceLink } from "#test/servingStoryTraits.ts";
import { localScreenshots, nestedProject, outsideFiles } from "#test/servingTraits.ts";
import { SCREENSHOT } from "#test/visuals.ts";

const UNAVAILABLE = "Local image unavailable: unsupported type, missing file or workspace boundary.";
const images = boardStory.traits(
	projectFiles({
		"nested/home.md": "# Visual review\n\n![First](../shots/first%20%26%20review.png)",
		"shots/a.constructor": "private",
		"shots/evil.svg": "<svg>private</svg>",
	}),
	boardHome("nested/home.md"),
	localScreenshots,
);

boardStory.it("a nested home's relative image link resolves to the image's attachment URL", [images], function* ({ documentLinks }) {
	expect(yield* documentLinks("")).toEqual({ "../shots/first%20%26%20review.png": "/_board/attachment/shots/first%20%26%20review.png" });
});

boardStory.it("an attachment answers with the screenshot's exact bytes as an unstored, unsniffed PNG", [images], function* ({ download }) {
	expect(yield* download("/_board/attachment/shots/first%20%26%20review.png")).toMatchObject({
		bytes: SCREENSHOT,
		cacheControl: "no-store",
		sniffing: "refused",
		status: "OK",
		type: "image/png",
	});
});

for (const [path, reason, setup, text] of [
	["shots/leak.png", "a file link leading outside the workspace", [workspaceLink("shots/leak.png", "the outside file")], UNAVAILABLE],
	["reference/outside.png", "a folder link leading outside the workspace", [workspaceLink("reference", "the outside folder")], UNAVAILABLE],
	["..%2fprivate.png", "an encoded step up to the image beside the workspace", [privateImageBesideWorkspace], UNAVAILABLE],
	["%2e%2e%5cprivate.png", "an encoded backslash step up to the image beside the workspace", [privateImageBesideWorkspace], UNAVAILABLE],
	["%ZZ.png", "broken percent-encoding", [], ""],
	[".hidden.png", "a hidden file", [], UNAVAILABLE],
	["nested/home.md", "a Markdown file", [], UNAVAILABLE],
	["shots/evil.svg", "an SVG that could carry script", [], UNAVAILABLE],
	["node_modules/image.png", "a dependency folder", [], UNAVAILABLE],
	["shots/a.constructor", "a name that matches an object property", [], UNAVAILABLE],
] as const) {
	boardStory.it(
		`the attachment ${path}, ${reason}, answers Not Found without its bytes`,
		[nestedProject("workspace"), images, outsideFiles({ "outside.png": "private" }), ...setup],
		function* ({ download }) {
			expect(yield* download(`/_board/attachment/${path}`)).toMatchObject({ status: "Not Found", text });
		},
	);
}

boardStory.it("editing a screenshot asks live readers to resync", [images], function* ({ editBytes, listenForChanges, nextAnnouncement }) {
	yield* listenForChanges();

	editBytes("shots/second.png", Buffer.concat([SCREENSHOT, Buffer.from("Updated")]));

	expect(yield* nextAnnouncement()).toBe("resync");
});

boardStory.it("an image larger than 16 MiB answers Payload Too Large and names the limit", [images], function* ({ download, resizeFile }) {
	resizeFile("shots/second.png", 16 * 1024 * 1024 + 1);

	expect(yield* download("/_board/attachment/shots/second.png")).toMatchObject({
		status: "Payload Too Large",
		text: "Local image exceeds the 16 MiB limit.",
	});
});
