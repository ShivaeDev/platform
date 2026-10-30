import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
const HOUR = 3_600_000;
const HISTORY_KEY = "work-board:library:history-fixture";
const files = {
	"notes/first.md": "# First\n",
	"notes/next.md": "---\nkind: task\nstatus: ready\n---\n# Next\n",
	"notes/old.md": "---\nkind: question\nscope: task\nurgency: whenever\n---\n# Old\n",
	"notes/plan.md": "# Plan\n",
};
const today = new Date(Effect.runSync(Clock.currentTimeMillis)).setHours(0, 0, 0, 0);
const yesterday = today - 12 * HOUR;
const lastWeek = today - 3 * 24 * HOUR + 12 * HOUR;
const reading = storedScreenState({
	[HISTORY_KEY]: JSON.stringify({
		favorites: [{ file: "notes/first.md", title: "First" }],
		recents: [
			{ at: yesterday, file: "notes/next.md", title: "Next" },
			{ at: yesterday - HOUR, file: "notes/first.md", title: "First" },
			{ at: lastWeek, file: "notes/old.md", title: "Old" },
			{ file: "notes/gone.md", title: "Gone" },
		],
	}),
});
const history = { name: "Reading history", role: "dialog" } as const;
const missing = /has 0 matches/u;
const RECENT_LINKS = 'section[aria-label="Recent"] a';

screenStory.it(
	"leaves pinned documents and the open page out of the sidebar's Recent list",
	[screenWorkspace("history-fixture"), reading, chromeScreen(files)],
	function* ({ findElements, navigate, readText }) {
		expect(findElements(RECENT_LINKS).map((link) => link.getAttribute("href"))).toEqual(["/notes/next.md", "/notes/old.md", "/notes/gone.md"]);
		yield* Effect.promise(() => navigate("/notes/next.md"));
		yield* eventually(() => expect(readText("#doc h1")).toBe("Next"));
		expect(findElements(RECENT_LINKS).map((link) => link.getAttribute("href"))).toEqual(["/notes/plan.md", "/notes/old.md", "/notes/gone.md"]);
	},
);

screenStory.it(
	"groups reading history by day and shows when each entry was read, its kind and status",
	[screenWorkspace("history-fixture"), reading, chromeScreen(files)],
	function* ({ findElements, roles }) {
		yield* roles.click({ name: "Reading history", role: "button" });
		const dated = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", weekday: "long" }).format(lastWeek);
		expect(findElements("#reading-library h3", document).map((heading) => heading.textContent)).toEqual([
			"Pinned",
			"Today",
			"Yesterday",
			dated,
			"Earlier",
		]);
		expect(roles.text({ name: "Today", role: "list" })).toMatch(/^Planread just now(?:·Document)?$/u);
		yield* eventually(() => expect(roles.text({ name: "Yesterday", role: "list" })).toMatch(/^Nextread .+ago·Task·ReadyFirstread .+ago·Document$/u));
		expect(roles.text({ name: dated, role: "list" })).toMatch(/^Oldread .+ago·Question$/u);
		expect(roles.text({ name: "Earlier", role: "list" })).toBe("Gone (missing)");
		expect(
			findElements("#reading-library time", document)
				.slice(1)
				.map((time) => time.getAttribute("datetime")),
		).toEqual([yesterday, yesterday - HOUR, lastWeek].map((at) => new Date(at).toISOString()));
	},
);

screenStory.it(
	"removes one history entry and moves focus to the next entry's remove button",
	[screenWorkspace("history-fixture"), reading, chromeScreen(files)],
	function* ({ findElements, readFocus, roles, stored }) {
		yield* roles.click({ name: "Reading history", role: "button" });
		yield* roles.click({ name: "Remove Next from history", role: "button" });
		yield* eventually(() => expect(roles.text({ name: "Yesterday", role: "list" })).not.toContain("Next"));
		expect(roles.accessible(readFocus() ?? document.body)).toEqual({ name: "Remove First from history", role: "button" });
		expect(findElements(RECENT_LINKS).map((link) => link.getAttribute("href"))).toEqual(["/notes/old.md", "/notes/gone.md"]);
		expect(JSON.parse(stored(HISTORY_KEY) ?? "{}").recents.map((item: { file: string }) => item.file)).toEqual([
			"notes/plan.md",
			"notes/first.md",
			"notes/old.md",
			"notes/gone.md",
		]);
	},
);

screenStory.it(
	"clears reading history only after an in-page confirmation and keeps pinned documents",
	[screenWorkspace("history-fixture"), reading, chromeScreen(files)],
	function* ({ findElements, readFocus, roles, stored }) {
		yield* roles.click({ name: "Reading history", role: "button" });
		yield* roles.click({ name: "Clear history", role: "button" });
		expect(roles.text({ name: "Remove 5 entries from history? Pinned documents stay.", role: "group" })).toContain("CancelClear");
		expect(roles.accessible(readFocus() ?? document.body)).toEqual({ name: "Cancel", role: "button" });
		yield* roles.click({ name: "Cancel", role: "button" });
		expect(roles.text({ name: "Yesterday", role: "list" })).toContain("Next");
		yield* roles.click({ name: "Clear history", role: "button" });
		yield* roles.click({ name: "Clear", role: "button" });
		yield* eventually(() => expect(findElements("#reading-library h3", document).map((heading) => heading.textContent)).toEqual(["Pinned"]));
		expect(roles.text({ name: "Pinned", role: "list" })).toBe("FirstDocument");
		expect(() => roles.text({ name: "Clear history", role: "button" })).toThrow(missing);
		expect(roles.accessible(readFocus() ?? document.body)).toEqual({ name: "Reading history", role: "dialog" });
		expect(JSON.parse(stored(HISTORY_KEY) ?? "{}")).toEqual({ favorites: [{ file: "notes/first.md", title: "First" }], recents: [] });
		expect(findElements(RECENT_LINKS).map((link) => link.getAttribute("href"))).toEqual([]);
		expect(roles.text(history)).not.toContain("Gone");
	},
);
