import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { chromeFixture } from "#test/chromeFixture.ts";
import { blockedStorage, fallibleDocument, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const files = chromeFixture();
for (const path of ["/_board/attachment/shots/review.png", "/_board/unsupported"]) {
	screenStory.it(`leaves ${path} to browser navigation`, [chromeScreen(files)], function* ({ click, location, readDocumentReads }) {
		const link = document.createElement("a");
		link.href = path;
		link.id = "browser-link";
		document.body.append(link);
		const before = readDocumentReads();
		let prevented: boolean | undefined;
		document.addEventListener(
			"click",
			(event) => {
				prevented = event.defaultPrevented;
				event.preventDefault();
			},
			{ once: true },
		);
		click(link);
		expect(prevented).toBe(false);
		expect(location()?.pathname).toBe("/notes/plan.md");
		expect(readDocumentReads()).toEqual(before);
		link.remove();
	});
}

screenStory.it(
	"keeps a deleted favorite visible and explains its missing target",
	[screenWorkspace("missing-favorite"), chromeScreen(files)],
	function* ({ click, navigate, deleteFile, refreshDocument, readText }) {
		click("#favorite-toggle");
		yield* Effect.promise(() => navigate("/notes/deep/proof.md"));
		deleteFile("notes/plan.md");
		yield* Effect.promise(() => refreshDocument());
		click("#library-open");
		yield* Effect.promise(() => eventually(() => expect(readText('#reading-library a[href="/notes/plan.md"]')).toContain("missing")));
		yield* Effect.promise(() => refreshDocument("/notes/plan.md"));
		click('#reading-library a[href="/notes/plan.md"]');
		yield* Effect.promise(() => eventually(() => expect(readText("#navigation-status")).toContain("missing or was renamed")));
		expect(readText("#doc [data-slot=empty-description]")).toBe("No Markdown file at notes/plan.md. It may have been moved or deleted.");
	},
);

screenStory.it(
	"keeps favorites usable across navigation with blocked storage",
	[screenWorkspace("blocked-favorites"), blockedStorage(), chromeScreen(files)],
	function* ({ click, navigate, readAttribute, readText }) {
		click("#favorite-toggle");
		expect(readAttribute("#favorite-toggle", "aria-pressed")).toBe("true");
		yield* Effect.promise(() => navigate("/notes/deep/proof.md"));
		expect(readText('section[aria-label="Pinned"] a[href="/notes/plan.md"]')).toBe("Plan");
		click("#library-open");
		expect(readText(".library-status", document)).toContain("this page only");
	},
);

screenStory.it(
	"retains the reading entry when the selected file is opened again",
	[screenWorkspace("same-reading"), chromeScreen(files)],
	function* ({ navigate, follow, openDetails, location, back, findElement }) {
		openDetails("article details");
		const entry = location();
		expect(entry).toBeDefined();
		yield* Effect.promise(() => follow("/notes/plan.md"));
		expect(location()).toBe(entry);
		yield* Effect.promise(() => navigate("/notes/deep/proof.md"));
		yield* Effect.promise(() => back());
		yield* Effect.promise(() => eventually(() => expect(findElement("article details")).toHaveProperty("open", true)));
	},
);

screenStory.it(
	"retries the same route after its document request fails",
	[fallibleDocument(), chromeScreen(files)],
	function* ({ failDocument, recoverDocument, follow, navigate, readText, readAttribute }) {
		failDocument();
		yield* Effect.promise(() => navigate("/notes/deep/proof.md"));
		yield* Effect.promise(() => eventually(() => expect(readText("#navigation-status")).toContain("Could not open")));
		expect(readAttribute("#doc", "data-route")).toBe("/notes/deep/proof.md");
		recoverDocument();
		yield* Effect.promise(() => follow("/notes/deep/proof.md"));
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Proof")));
	},
);

for (const failed of [false, true]) {
	screenStory.it(
		`ignores a held page refresh after newer navigation (failed: ${failed})`,
		[chromeScreen(files)],
		function* ({ pauseRead, refreshDocument, refreshStarted, navigate, releaseRefresh, readText, readAttribute, frame }) {
			pauseRead("/notes/plan.md", failed);
			yield* Effect.promise(() => refreshDocument());
			yield* Effect.promise(() => eventually(() => expect(refreshStarted()).toBe(true)));
			yield* Effect.promise(() => navigate("/notes/deep/proof.md"));
			yield* Effect.promise(() => releaseRefresh());
			yield* Effect.promise(() => frame());
			expect(readText("#doc h1")).toBe("Proof");
			expect(readAttribute("#doc", "data-file")).toBe("notes/deep/proof.md");
		},
	);
}

screenStory.it(
	"replaces a held invalidation and ignores its late document result",
	[chromeScreen(files)],
	function* ({ pauseRead, editFile, refreshDocument, refreshStarted, releaseRefresh, readText, frame }) {
		pauseRead("/notes/plan.md");
		editFile("notes/plan.md", "# Older source");
		yield* Effect.promise(() => refreshDocument());
		yield* Effect.promise(() => eventually(() => expect(refreshStarted()).toBe(true)));
		editFile("notes/plan.md", "# Newest source");
		yield* Effect.promise(() => refreshDocument());
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Newest source")));
		yield* Effect.promise(() => releaseRefresh());
		yield* Effect.promise(() => frame());
		expect(readText("#doc h1")).toBe("Newest source");
	},
);

screenStory.it(
	"shows the not-found page after the current file is deleted",
	[chromeScreen(files)],
	function* ({ deleteFile, refreshDocument, readText, readNavigation }) {
		deleteFile("notes/plan.md");
		yield* Effect.promise(() => refreshDocument());
		yield* Effect.promise(() =>
			eventually(() =>
				expect(readText("#doc [data-slot=empty-description]")).toBe("No Markdown file at notes/plan.md. It may have been moved or deleted."),
			),
		);
		const navigation = yield* Effect.promise(() => readNavigation());
		expect(navigation.counts.library).toBe(Object.keys(files).length - 1);
	},
);
