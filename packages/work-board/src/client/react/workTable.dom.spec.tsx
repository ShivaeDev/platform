import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { fleetWorkspace, fleetWorkspaceItems } from "#test/fleetWorkspaceFixture.ts";
import { nowScreen } from "#test/nowScreen.tsx";
import { nowFleet } from "#test/nowWork.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenFleet, screenRoute } from "#test/screenWorkspaceTraits.ts";
import { labelledCombobox, menuOptions, workRouteParams, workTableScreen, workTableTitles } from "#test/workScreens.ts";
import { WorkNow } from "./WorkNow.tsx";

expectNoReactWarnings();

screenStory.it(
	"sorts the Table by its column headers and reverses the order on a second click",
	[workTableScreen("/_board/work?view=table")],
	function* ({ roles }) {
		yield* Effect.promise(() => eventually(() => expect(workTableTitles().length).toBeGreaterThan(2)));
		const ascending = workTableTitles();
		expect(ascending).toEqual([...ascending].sort((left, right) => (left ?? "").localeCompare(right ?? "", "en")));
		expect(roles.accessible("#work-results th[aria-sort]")).toEqual({ name: "Work", role: "columnheader" });
		expect(document.querySelector("#work-results th[aria-sort]")?.getAttribute("aria-sort")).toBe("ascending");
		yield* roles.click({ name: "Work", role: "link" });
		yield* Effect.promise(() => eventually(() => expect(workRouteParams().get("order")).toBe("desc")));
		yield* Effect.promise(() => eventually(() => expect(workTableTitles()).toEqual([...ascending].reverse())));
		expect(document.querySelector("#work-results th[aria-sort]")?.getAttribute("aria-sort")).toBe("descending");
		yield* roles.click({ name: "Owner", role: "link" });
		yield* Effect.promise(() => eventually(() => expect(workRouteParams().get("sort")).toBe("owner")));
		expect(workRouteParams().get("order")).toBeNull();
		yield* Effect.promise(() =>
			eventually(() => expect(roles.accessible("#work-results th[aria-sort]")).toEqual({ name: "Owner", role: "columnheader" })),
		);
	},
);

screenStory.it(
	"heads each Table row with a link named by its title and shows the ID beside it",
	[workTableScreen("/_board/work?view=table")],
	function* ({ roles }) {
		yield* Effect.promise(() => eventually(() => expect(workTableTitles().length).toBeGreaterThan(2)));
		for (const row of document.querySelectorAll<HTMLElement>("#work-results tbody tr[data-item]")) {
			const header = row.querySelector("th[scope='row']");
			const link = header?.querySelector("a");
			expect(link && roles.accessible(link)).toEqual({ name: link?.textContent, role: "link" });
			expect(link?.textContent).not.toBe(row.dataset.item);
			expect(new URL(link?.href ?? "", "http://board").searchParams.get("item")).toBe(row.dataset.item);
			expect(header?.querySelector(".font-mono")?.textContent).toBe(row.dataset.item);
		}
	},
);

screenStory.it(
	"filters All work by text and offers Reset only while a filter applies",
	[workTableScreen("/_board/work?view=table")],
	function* ({ roles }) {
		yield* Effect.promise(() => eventually(() => expect(workTableTitles().length).toBeGreaterThan(2)));
		const all = workTableTitles();
		expect(document.querySelector("#work-filters a")).toBeNull();
		yield* roles.enter({ name: "Find work", role: "searchbox" }, "upload");
		yield* roles.click({ name: "Apply", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(workTableTitles()).toEqual(["Fix the flaky upload test"])));
		expect(Object.fromEntries(workRouteParams())).toEqual({ q: "upload", sort: "title", view: "table" });
		yield* roles.click({ name: "Reset", role: "link" });
		yield* Effect.promise(() => eventually(() => expect(workTableTitles()).toEqual(all)));
		expect(document.querySelector("#work-filters a")).toBeNull();
	},
);

screenStory.it(
	"saves the sorted Table as a local view that opens with its order and can be removed",
	[workTableScreen("/_board/work?view=table&sort=owner&order=desc")],
	function* ({ roles }) {
		yield* Effect.promise(() => eventually(() => expect(workTableTitles().length).toBeGreaterThan(2)));
		expect(document.querySelector("#open-saved-view")).toHaveProperty("hidden", true);
		yield* roles.enter({ name: "View name", role: "textbox" }, "By owner");
		yield* roles.click({ name: "Save view", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(roles.text("#saved-view")).toBe("By owner")));
		const open = new URL(document.querySelector<HTMLAnchorElement>("#open-saved-view")?.href ?? "", "http://board");
		expect(Object.fromEntries(open.searchParams)).toMatchObject({ order: "desc", sort: "owner", view: "table" });
		function saved() {
			return document.querySelector("#saved-view") ?? undefined;
		}
		yield* roles.click("#saved-view");
		yield* roles.click({ name: "Choose a saved view", role: "option" });
		yield* Effect.promise(() => eventually(() => expect(document.querySelector("#open-saved-view")).toHaveProperty("hidden", true)));
		yield* roles.click("#saved-view");
		expect(menuOptions(saved()).map((option) => option.textContent)).toEqual(["Choose a saved view", "By owner"]);
		yield* roles.click({ name: "By owner", role: "option" });
		yield* Effect.promise(() => eventually(() => expect(document.querySelector("#open-saved-view")).toHaveProperty("hidden", false)));
		yield* roles.click({ name: "Remove", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(document.querySelector("#open-saved-view")).toHaveProperty("hidden", true)));
		expect(roles.text("#saved-view")).toBe("No saved views");
	},
);

screenStory.it(
	"marks empty Now lanes and keeps Done closed until the reader opens it",
	[nowScreen(6, WorkNow, nowFleet(3, Effect.runSync(Clock.currentTimeMillis)))],
	function* ({ findElements, readText, roles }) {
		expect(readText('section[aria-label="Delivering"]')).toBe("Delivering0Nothing here");
		expect(findElements(".work-columns > section").map((lane) => lane.getAttribute("aria-label"))).toEqual([
			"Queued",
			"Executing",
			"Reviewing",
			"Delivering",
			"Waiting on a person",
		]);
		const done = { name: "Done in the last 7 days", role: "button" } as const;
		expect(document.querySelector('section[aria-label="Done in the last 7 days"] [data-item]')).toBeNull();
		expect(document.querySelector('section[aria-label="Done in the last 7 days"] [aria-expanded]')?.getAttribute("aria-expanded")).toBe("false");
		yield* roles.click(done);
		yield* Effect.promise(() =>
			eventually(() =>
				expect(
					[...document.querySelectorAll('section[aria-label="Done in the last 7 days"] [data-item]')].map((card) => card.getAttribute("data-item")),
				).toEqual(["task-5"]),
			),
		);
		expect(document.querySelector('section[aria-label="Done in the last 7 days"] [aria-expanded]')?.getAttribute("aria-expanded")).toBe("true");
	},
);

screenStory.it(
	"announces unavailable Fleet data in one status alert above the Now lanes",
	[nowScreen(6, WorkNow, { reason: "Fleet is offline.", state: "unavailable" })],
	({ findElements }) => {
		expect(findElements('[role="status"][data-slot="alert"]').map((alert) => alert.textContent)).toEqual([
			"Lanes show the status written in each file. Fleet is offline.",
		]);
	},
);

screenStory.it(
	"shows one Now lane at a time on a phone and switches lanes from the lane tabs",
	[screenMedia(["(max-width: 767px)"]), nowScreen(6, WorkNow, nowFleet(3, Effect.runSync(Clock.currentTimeMillis)))],
	function* ({ findElements, roles }) {
		function shown() {
			return findElements("[role='tabpanel'] section.work-column").map((lane) => lane.getAttribute("aria-label"));
		}
		function cards() {
			return findElements("[role='tabpanel'] [data-item]").map((card) => card.getAttribute("data-item"));
		}
		expect(roles.accessible("[role='tablist']")).toEqual({ name: "Lanes", role: "tablist" });
		expect(shown()).toEqual(["Queued"]);
		yield* roles.click({ name: "Reviewing 1", role: "tab" });
		yield* Effect.promise(() => eventually(() => expect(shown()).toEqual(["Reviewing"])));
		expect(cards()).toEqual(["task-2"]);
	},
);

screenStory.it(
	"heads each All work status group with a count badge for its cards",
	[workTableScreen("/_board/work?view=board")],
	function* ({ findElements }) {
		yield* Effect.promise(() => eventually(() => expect(findElements(".work-column").length).toBeGreaterThan(1)));
		for (const column of findElements(".work-column")) {
			expect(findElements("h2 .work-count[data-slot='badge']", column).map((badge) => badge.textContent)).toEqual([
				String(findElements("[data-item]", column).length),
			]);
		}
	},
);

for (const [route, name] of [
	["/_board/work", "Now"],
	["/_board/work?view=board", "All work"],
	["/_board/work?view=table", "Table"],
] as const) {
	screenStory.it(`names the ${name} view in the page heading and its pressed tab`, [workTableScreen(route)], function* ({ readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("main h1")).toBe(name)));
		expect(readText('nav[aria-label="Work layout"] [aria-current="page"]')).toBe(name);
	});
}

screenStory.it(
	"counts in the sidebar the same open tasks the Now lanes show",
	[
		screenFiles(
			{ ...fleetWorkspace, "tasks/later.md": "---\nid: task.later\nkind: task\nstatus: planned\n---\n# Plan the later work\n" },
			{ home: "home.md" },
		),
		screenFleet(fleetWorkspaceItems(Effect.runSync(Clock.currentTimeMillis))),
		screenRoute("/_board/work"),
		openScreen(),
	],
	function* ({ findElements }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(findElements("#primary-navigation a").map((link) => link.getAttribute("aria-label"))).toContain(
					`Now, ${findElements(".work-columns [data-item]").length} open tasks`,
				),
			),
		);
		expect(findElements(".work-columns [data-item]").map((card) => card.getAttribute("data-item"))).toEqual([
			"task.pricing",
			"task.guide",
			"task.upload",
			"task.email",
		]);
	},
);

screenStory.it(
	"filters All work by owner and sorts it from the toolbar menus",
	[workTableScreen("/_board/work?view=board")],
	function* ({ findElements, roles }) {
		function menu(label: string) {
			return labelledCombobox(findElements("main [role='combobox']"), label);
		}
		yield* Effect.promise(() => eventually(() => expect(menu("Sort by")).toBeDefined()));
		yield* roles.click(`#${CSS.escape(menu("Owner")?.id ?? "")}`);
		yield* roles.click({ name: "maintainer", role: "option" });
		yield* Effect.promise(() => eventually(() => expect(workRouteParams().get("owner")).toBe("value:maintainer")));
		yield* Effect.promise(() =>
			eventually(() => expect(findElements("[data-item]").map((card) => card.getAttribute("data-item"))).toEqual(["task.pricing"])),
		);
		yield* roles.click(`#${CSS.escape(menu("Sort by")?.id ?? "")}`);
		yield* roles.click({ name: "Owner", role: "option" });
		yield* Effect.promise(() =>
			eventually(() => expect(Object.fromEntries(workRouteParams())).toEqual({ owner: "value:maintainer", sort: "owner", view: "board" })),
		);
	},
);

screenStory.it(
	"keeps an unavailable board and an unmatched status visible in the toolbar menus",
	[workTableScreen("/_board/work?view=table&board=board.missing&status=value:paused")],
	function* ({ findElements, readText }) {
		function chosen(label: string) {
			return readText("[data-slot='select-value']", labelledCombobox(findElements("main [role='combobox']"), label));
		}
		yield* Effect.promise(() => eventually(() => expect(chosen("Board")).toBe("board.missing (unavailable)")));
		expect(chosen("Status")).toBe("Paused (no current matches)");
	},
);

screenStory.it(
	"marks the selected item's Table row and its title link",
	[workTableScreen("/_board/work?view=table&item=task.upload")],
	function* ({ findElements }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(findElements("#work-results tr[data-state='selected']").map((row) => row.getAttribute("data-item"))).toEqual(["task.upload"]),
			),
		);
		expect(findElements("#work-results tbody a[aria-current='true']").map((link) => link.textContent)).toEqual(["Fix the flaky upload test"]);
	},
);
