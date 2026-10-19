import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { nowScreen } from "#test/nowScreen.tsx";
import { nowFleet } from "#test/nowWork.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { workRouteParams, workTableScreen, workTableTitles } from "#test/workScreens.ts";
import { WorkNow } from "./WorkNow.tsx";

expectNoReactWarnings();

screenStory.it("sorts the Table by its column headers and reverses the order on a second click", [workTableScreen("/_board/work?view=table")], function* ({ roles }) {
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
	yield* Effect.promise(() => eventually(() => expect(roles.accessible("#work-results th[aria-sort]")).toEqual({ name: "Owner", role: "columnheader" })));
});

screenStory.it("heads each Table row with a link named by its title and shows the ID beside it", [workTableScreen("/_board/work?view=table")], function* ({ roles }) {
	yield* Effect.promise(() => eventually(() => expect(workTableTitles().length).toBeGreaterThan(2)));
	for (const row of document.querySelectorAll<HTMLElement>("#work-results tbody tr[data-item]")) {
		const header = row.querySelector("th[scope='row']");
		const link = header?.querySelector("a");
		expect(link && roles.accessible(link)).toEqual({ name: link?.textContent, role: "link" });
		expect(link?.textContent).not.toBe(row.dataset.item);
		expect(new URL(link?.href ?? "", "http://board").searchParams.get("item")).toBe(row.dataset.item);
		expect(header?.querySelector(".font-mono")?.textContent).toBe(row.dataset.item);
	}
});

screenStory.it("filters All work by text and offers Reset only while a filter applies", [workTableScreen("/_board/work?view=table")], function* ({ roles }) {
	yield* Effect.promise(() => eventually(() => expect(workTableTitles().length).toBeGreaterThan(2)));
	const all = workTableTitles();
	expect(document.querySelector("#work-filters a")).toBeNull();
	yield* roles.enter({ name: "Find work", role: "searchbox" }, "upload");
	yield* roles.click({ name: "Apply", role: "button" });
	yield* Effect.promise(() => eventually(() => expect(workTableTitles()).toEqual(["Fix the flaky upload test"])));
	expect(workRouteParams().get("q")).toBe("upload");
	yield* roles.click({ name: "Reset", role: "link" });
	yield* Effect.promise(() => eventually(() => expect(workTableTitles()).toEqual(all)));
	expect(document.querySelector("#work-filters a")).toBeNull();
});

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
		yield* roles.click({ name: "Remove", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(document.querySelector("#open-saved-view")).toHaveProperty("hidden", true)));
		expect(roles.text("#saved-view")).toBe("No saved views");
	},
);

screenStory.it("marks empty Now lanes and keeps Done closed until the reader opens it", [nowScreen(6, WorkNow, nowFleet(3, Date.now()))], function* ({ readText, roles }) {
	expect(readText('section[aria-label="Delivering"]')).toBe("Delivering0Nothing here");
	const done = { name: "Done in the last 7 days", role: "button" } as const;
	expect(document.querySelector('section[aria-label="Done in the last 7 days"] [data-item]')).toBeNull();
	expect(document.querySelector('section[aria-label="Done in the last 7 days"] [aria-expanded]')?.getAttribute("aria-expanded")).toBe("false");
	yield* roles.click(done);
	yield* Effect.promise(() =>
		eventually(() =>
			expect([...document.querySelectorAll('section[aria-label="Done in the last 7 days"] [data-item]')].map((card) => card.getAttribute("data-item"))).toEqual([
				"task-5",
			]),
		),
	);
	expect(document.querySelector('section[aria-label="Done in the last 7 days"] [aria-expanded]')?.getAttribute("aria-expanded")).toBe("true");
});

screenStory.it("announces unavailable Fleet data in one status alert above the Now lanes", [nowScreen(6, WorkNow, { reason: "Fleet is offline.", state: "unavailable" })], ({ findElements }) => {
	expect(findElements('[role="status"][data-slot="alert"]').map((alert) => alert.textContent)).toEqual([
		"Fleet is unavailable. Lanes use authored status. Fleet is offline.",
	]);
});

screenStory.it(
	"shows one Now lane at a time on a phone and switches lanes from the lane tabs",
	[screenMedia(["(max-width: 767px)"]), nowScreen(6, WorkNow, nowFleet(3, Date.now()))],
	function* ({ findElements, roles }) {
		const shown = () => findElements("[role='tabpanel'] section.work-column").map((lane) => lane.getAttribute("aria-label"));
		const cards = () => findElements("[role='tabpanel'] [data-item]").map((card) => card.getAttribute("data-item"));
		expect(roles.accessible("[role='tablist']")).toEqual({ name: "Lanes", role: "tablist" });
		expect(shown()).toEqual(["Queued"]);
		yield* roles.click({ name: "Reviewing 1", role: "tab" });
		yield* Effect.promise(() => eventually(() => expect(shown()).toEqual(["Reviewing"])));
		expect(cards()).toEqual(["task-2"]);
	},
);
