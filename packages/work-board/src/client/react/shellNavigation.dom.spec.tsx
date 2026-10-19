import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenMedia, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, pausedDocument, routedScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
const files = {
	"home.md": "# Home\n\n## Plans\n",
	"notes/first.md": "# First\n",
	"notes/next.md": "---\nid: note.next\n---\n# Next\n",
	"notes/plan.md": "# Plan\n",
};
const reading = storedScreenState({
	"work-board:library:shell-fixture": JSON.stringify({
		favorites: [{ file: "notes/first.md", title: "First" }],
		recents: [
			{ file: "notes/plan.md", title: "Plan" },
			{ file: "notes/next.md", title: "Next" },
		],
	}),
});

screenStory.it(
	"opens reading history as a dialog of labelled lists and closes it with Escape",
	[screenWorkspace("shell-fixture"), reading, chromeScreen(files)],
	function* ({ click, findByRole, keyboard, readFocus }) {
		const opener = findByRole("button", "Reading history");
		click(opener);
		const dialog = findByRole("dialog", "Reading history", document);
		expect(dialog).not.toBeNull();
		const pinned = findByRole("list", "Pinned", dialog);
		expect(findByRole("link", "First", pinned)?.getAttribute("href")).toBe("/notes/first.md");
		const recent = findByRole("list", "Recent documents", dialog);
		expect(findByRole("link", "Plan", recent)?.getAttribute("aria-current")).toBe("page");
		expect(findByRole("link", "Next", recent)?.getAttribute("href")).toBe("/notes/next.md");
		keyboard("Escape");
		yield* Effect.promise(() => eventually(() => expect(findByRole("dialog", "Reading history", document)).toBeNull()));
		yield* Effect.promise(() => eventually(() => expect(readFocus()).toBe(opener)));
	},
);

screenStory.it(
	"marks the clicked destination current at once and shows pending feedback only after the threshold",
	[pausedDocument("/_board/item/note.next/"), routedScreen(files, "/_board/goals", { home: "home.md" })],
	function* ({ findByRole, readAttribute, startNavigation, readStarted, releaseRead, finishNavigation, readText }) {
		const workspace = findByRole("navigation", "Workspace");
		yield* Effect.promise(() => eventually(() => expect(readAttribute('[aria-current="page"]', "aria-label", workspace)).toBe("Goals")));
		yield* Effect.promise(() => startNavigation("/_board/work?item=note.next"));
		yield* Effect.promise(() => eventually(() => expect(readStarted()).toBe(true)));
		expect(readAttribute('[aria-current="page"]', "aria-label", workspace)).toMatch(/^Now/u);
		expect(findByRole("progressbar", "Opening page")).toBeNull();
		yield* Effect.promise(() => eventually(() => expect(findByRole("progressbar", "Opening page")).not.toBeNull()));
		yield* Effect.promise(releaseRead);
		yield* Effect.promise(finishNavigation);
		yield* Effect.promise(() => eventually(() => expect(readText(".work-head h1")).toBe("Now")));
		expect(findByRole("progressbar", "Opening page")).toBeNull();
		expect(readAttribute('[aria-current="page"]', "aria-label", workspace)).toMatch(/^Now/u);
	},
);

screenStory.it(
	"pins and unpins the open document into the sidebar's Pinned list",
	[screenWorkspace("shell-fixture"), chromeScreen(files)],
	function* ({ click, findByRole }) {
		const pinned = findByRole("region", "Pinned");
		expect(findByRole("link", "Plan", pinned)).toBeNull();
		click(findByRole("button", "Pin"));
		yield* Effect.promise(() => eventually(() => expect(findByRole("link", "Plan", pinned)?.getAttribute("href")).toBe("/notes/plan.md")));
		click(findByRole("button", "Unpin"));
		yield* Effect.promise(() => eventually(() => expect(findByRole("link", "Plan", pinned)).toBeNull()));
		expect(findByRole("button", "Pin")).not.toBeNull();
	},
);

screenStory.it(
	"offers pinned and recent documents and reading history from the phone's More sheet",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), screenWorkspace("shell-fixture"), reading, chromeScreen(files)],
	function* ({ click, findByRole, keyboard, readFocus }) {
		const more = findByRole("button", "More");
		click(more);
		const sheet = findByRole("dialog", "More", document);
		expect(findByRole("link", "First", findByRole("region", "Pinned", sheet))?.getAttribute("href")).toBe("/notes/first.md");
		expect(findByRole("link", "Next", findByRole("region", "Recent", sheet))?.getAttribute("href")).toBe("/notes/next.md");
		click(findByRole("button", "Reading history", sheet));
		yield* Effect.promise(() => eventually(() => expect(findByRole("dialog", "More", document)).toBeNull()));
		yield* Effect.promise(() => eventually(() => expect(findByRole("dialog", "Reading history", document)).not.toBeNull()));
		keyboard("Escape");
		yield* Effect.promise(() => eventually(() => expect(findByRole("dialog", "Reading history", document)).toBeNull()));
		yield* Effect.promise(() => eventually(() => expect(readFocus()).toBe(more)));
	},
);
