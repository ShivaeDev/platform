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

const missing = /has 0 matches/u;
screenStory.it(
	"opens reading history as a dialog of labelled lists and closes it with Escape",
	[screenWorkspace("shell-fixture"), reading, chromeScreen(files)],
	function* ({ findElements, keyboard, readFocus, roles }) {
		yield* roles.click({ name: "Reading history", role: "button" });
		expect(roles.text({ name: "Pinned", role: "list" })).toBe("First");
		expect(roles.text({ name: "Recent documents", role: "list" })).toContain("Next");
		expect(
			findElements(`[role="dialog"] a[href]`, document).map((link) => [
				roles.accessible(link).name,
				link.getAttribute("href"),
				link.getAttribute("aria-current"),
			]),
		).toEqual([
			["First", "/notes/first.md", null],
			["Plan", "/notes/plan.md", "page"],
			["Next", "/notes/next.md", null],
		]);
		keyboard("Escape");
		yield* Effect.promise(() => eventually(() => expect(() => roles.text({ name: "Reading history", role: "dialog" })).toThrow(missing)));
		yield* Effect.promise(() =>
			eventually(() => expect(roles.accessible(readFocus() ?? document.body)).toEqual({ name: "Reading history", role: "button" })),
		);
	},
);

screenStory.it(
	"marks the clicked destination current at once and shows pending feedback only after the threshold",
	[pausedDocument("/_board/item/note.next/"), routedScreen(files, "/_board/goals", { home: "home.md" })],
	function* ({ readAttribute, startNavigation, readStarted, releaseRead, finishNavigation, readText, roles }) {
		const current = '[aria-label="Workspace"] [aria-current="page"]';
		const progress = { name: "Opening page", role: "progressbar" } as const;
		yield* Effect.promise(() => eventually(() => expect(readAttribute(current, "aria-label")).toBe("Goals")));
		yield* Effect.promise(() => startNavigation("/_board/work?item=note.next"));
		yield* Effect.promise(() => eventually(() => expect(readStarted()).toBe(true)));
		expect(readAttribute(current, "aria-label")).toMatch(/^Now/u);
		expect(() => roles.text(progress)).toThrow(missing);
		yield* Effect.promise(() => eventually(() => expect(() => roles.text(progress)).not.toThrow()));
		yield* Effect.promise(releaseRead);
		yield* Effect.promise(finishNavigation);
		yield* Effect.promise(() => eventually(() => expect(readText(".work-head h1")).toBe("Now")));
		expect(() => roles.text(progress)).toThrow(missing);
		expect(readAttribute(current, "aria-label")).toMatch(/^Now/u);
	},
);

screenStory.it(
	"pins and unpins the open document into the sidebar's Pinned list",
	[screenWorkspace("shell-fixture"), chromeScreen(files)],
	function* ({ roles }) {
		const pinned = { name: "Pinned", role: "region" } as const;
		expect(roles.text(pinned)).not.toContain("Plan");
		yield* roles.click({ name: "Pin", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(roles.text(pinned)).toContain("Plan")));
		yield* roles.click({ name: "Unpin", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(roles.text(pinned)).not.toContain("Plan")));
		expect(roles.text({ name: "Pin", role: "button" })).toBe("Pin");
	},
);

screenStory.it(
	"offers pinned and recent documents and reading history from the phone's More sheet",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), screenWorkspace("shell-fixture"), reading, chromeScreen(files)],
	function* ({ findElements, keyboard, readFocus, roles }) {
		yield* roles.click({ name: "More", role: "button" });
		expect(roles.text({ name: "More", role: "dialog" })).toContain("Reading history");
		expect(
			findElements(`[role="dialog"] section a[href]`, document).map((link) => [
				roles.accessible(link).name,
				link.getAttribute("href"),
				link.getAttribute("aria-current"),
			]),
		).toEqual([
			["First", "/notes/first.md", null],
			["Plan", "/notes/plan.md", "page"],
			["Next", "/notes/next.md", null],
		]);
		yield* roles.click({ name: "Reading history", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(() => roles.text({ name: "More", role: "dialog" })).toThrow(missing)));
		yield* Effect.promise(() => eventually(() => expect(roles.text({ name: "Recent documents", role: "list" })).toContain("Next")));
		keyboard("Escape");
		yield* Effect.promise(() => eventually(() => expect(() => roles.text({ name: "Reading history", role: "dialog" })).toThrow(missing)));
		yield* Effect.promise(() => eventually(() => expect(roles.accessible(readFocus() ?? document.body)).toEqual({ name: "More", role: "button" })));
	},
);
