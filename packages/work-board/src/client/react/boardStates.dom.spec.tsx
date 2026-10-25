import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { heldWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen, chromeScreen, openScreen, routedScreen } from "#test/screenTraits.ts";
import { screenRoute, todayScreen } from "#test/screenWorkspaceTraits.ts";
import { searchScreen } from "#test/searchScreen.tsx";
import { DocumentMain } from "./DocumentMain.tsx";
import { ProjectionMain } from "./ProjectionMain.tsx";

expectNoReactWarnings();

for (const { label, shape, url } of [
	{ label: "Loading Today", shape: "today", url: "/" },
	{ label: "Loading Goals", shape: "cards", url: "/_board/goals" },
	{ label: "Loading Now", shape: "lanes", url: "/_board/work" },
	{ label: "Loading All work", shape: "table", url: "/_board/work?view=table" },
	{ label: "Loading Library", shape: "rows", url: "/_board/library" },
	{ label: "Loading System", shape: "cards", url: "/_board/system" },
]) {
	screenStory.it(
		`holds a ${shape}-shaped skeleton on ${url} until its data arrives`,
		[todayScreen(), screenRoute(url), heldWorkspace(), openScreen()],
		function* ({ findElement, findElements, readText, releaseWorkspace }) {
			yield* eventually(() => expect(readText('#doc [role="status"][aria-busy="true"]')).toBe(label));
			expect(findElement(`#doc [data-loading-shape="${shape}"]`)).not.toBeNull();
			expect(findElements('#doc [data-slot="skeleton"]').length).toBeGreaterThan(4);
			expect(findElement("#doc h1")).toBeNull();
			yield* Effect.promise(releaseWorkspace);
			yield* eventually(() => expect(findElement("#doc h1")).not.toBeNull());
			yield* eventually(() => expect(findElement("#doc > [data-loading]")).toBeNull());
		},
	);
}

screenStory.it(
	"holds a lanes-shaped skeleton while a board document's lanes load",
	[
		boardScreen(
			{ "board.md": "---\nid: board.held\nitems: []\n---\n# Held board\n", "home.md": "# Home" },
			(api) => <ProjectionMain api={api} onPage={() => undefined} route="board" url="/board.md" />,
			{ beforeIndex: () => Effect.never, home: "home.md" },
		),
	],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(readText('#doc [role="status"][aria-busy="true"]')).toBe("Loading board"));
		expect(findElement('#doc [data-loading-shape="lanes"]')).not.toBeNull();
	},
);

screenStory.it(
	"tells an empty Today what fills Needs you and Goals and where to go next",
	[routedScreen({}, "/")],
	function* ({ readText, findElement }) {
		yield* eventually(() => expect(readText('#needs-you [data-slot="empty-title"]')).toBe("Nothing needs you"));
		expect(readText('#needs-you [data-slot="empty-description"]')).toBe(
			"Questions and reviews from your agents appear here when they need your answer.",
		);
		expect(readText('#needs-you [data-slot="empty"] a[href="/_board/start"]')).toBe("Getting started");
		yield* eventually(() => expect(readText('#today-goals [data-slot="empty-title"]')).toBe("No active goals"));
		expect(readText('#today-goals [data-slot="empty"] a[href="/_board/goals"]')).toBe("All goals");
		expect(findElement("#doc [data-loading]")).toBeNull();
	},
);

screenStory.it(
	"shows one empty state instead of empty lanes when a workspace declares no work",
	[routedScreen({ "notes.md": "# Notes" }, "/_board/work")],
	function* ({ readText, findElement }) {
		yield* eventually(() => expect(readText('#work-results [data-slot="empty-title"]')).toBe("No work yet"));
		expect(readText('#work-results [data-slot="empty"] a[href="/_board/start"]')).toBe("Getting started");
		expect(findElement("#work-results .work-columns")).toBeNull();
		expect(readText("#work-results")).not.toContain("No identified work");
	},
);

screenStory.it(
	"offers All work when the chosen board lists no work",
	[routedScreen({ "board.md": "---\nid: board.empty\nitems: []\n---\n# Empty board\n" }, "/_board/work?view=board&board=board.empty")],
	function* ({ readText, readAttribute }) {
		yield* eventually(() => expect(readText('#work-results [data-slot="empty-title"]')).toBe("No work on this board"));
		expect(readAttribute('#work-results [data-slot="empty"] a', "href")).toBe("/_board/work?view=board&sort=title");
	},
);

const work = {
	"task.md": "---\nid: task.build\nkind: task\nstatus: ready\n---\n# Build the page\n",
};

screenStory.it(
	"replaces a zero-row table with a matching-work empty state that clears the filters",
	[routedScreen(work, "/_board/work?view=table&q=nothing-matches")],
	function* ({ readText, readAttribute, findElement }) {
		yield* eventually(() => expect(readText('#work-results [data-slot="empty-title"]')).toBe("No matching work"));
		expect(findElement("#work-results table")).toBeNull();
		expect(readText('#work-results [data-slot="empty"] a')).toBe("Clear filters");
		expect(readAttribute('#work-results [data-slot="empty"] a', "href")).toBe("/_board/work?view=table&sort=title#work-results");
	},
);

screenStory.it("names what fills each empty Now lane", [routedScreen(work, "/_board/work")], function* ({ readText, findElement }) {
	yield* eventually(() => expect(readText('[aria-label="Queued"]')).toContain("Build"));
	expect(findElement('[aria-label="Queued"] [data-slot="empty"]')).toBeNull();
	expect(readText('[aria-label="Working"] [data-slot="empty-title"]')).toBe("Nothing working");
	expect(readText('[aria-label="Working"] [data-slot="empty-description"]')).toBe("Work an agent is building appears here.");
	expect(readText('[aria-label="Reviewing"] [data-slot="empty-title"]')).toBe("Nothing in review");
	expect(readText('[aria-label="Waiting on you"] [data-slot="empty-title"]')).toBe("Nothing waiting on you");
});

screenStory.it("tells an empty Library what fills it", [routedScreen({}, "/_board/library")], function* ({ readText }) {
	yield* eventually(() => expect(readText('#doc [data-slot="empty-title"]')).toBe("No documents yet"));
	expect(readText('#doc [data-slot="empty"] a[href="/_board/start"]')).toBe("Getting started");
});

screenStory.it(
	"lets the reader clear Library filters that match no document",
	[routedScreen({ ...work, "notes.md": "---\nstatus: done\n---\n# Closed notes\n" }, "/_board/library")],
	function* ({ findElement, findElements, readText, roles }) {
		yield* eventually(() => expect(readText('#doc a[href="/task.md"]')).toBe("Build the page"));
		expect(readText('#doc li:has(a[href="/task.md"]) p')).toBe("Task · Ready");
		yield* roles.click({ name: "Kind", role: "combobox" });
		yield* roles.click({ name: "Task", role: "option" });
		yield* roles.click({ name: "Status", role: "combobox" });
		yield* roles.click({ name: "Done", role: "option" });
		yield* eventually(() => expect(readText('#doc [data-slot="empty-title"]')).toBe("No matching documents"));
		yield* roles.click({ name: "Show all documents", role: "link" });
		yield* eventually(() => expect(findElements("#doc li a").map((link) => link.getAttribute("href"))).toEqual(["/notes.md", "/task.md"]));
		expect(findElement('#doc [data-slot="empty"]')).toBeNull();
	},
);

screenStory.it(
	"tells a goal page that it has no criteria and no linked work yet",
	[
		boardScreen(
			{ "bare.md": "---\nid: project.bare\nkind: goal\nstatus: draft\n---\n# Empty goal\n", "home.md": "# Home" },
			(api) => <DocumentMain api={api} onPage={() => undefined} url="/bare.md" />,
			{ home: "home.md" },
		),
	],
	function* ({ readText, findElement }) {
		yield* eventually(() => expect(readText('[data-goal-section="progress"] [data-slot="empty-title"]')).toBe("No linked work"));
		expect(readText('[data-goal-section="criteria"] [data-slot="empty-title"]')).toBe("No criteria");
		expect(findElement('[data-goal-section="progress"] [data-goal-counts], [data-goal-section="progress"] [role="progressbar"]')).toBeNull();
		expect(readText('[data-goal-section="progress"]')).not.toContain("linked items");
		expect(findElement('[data-goal-section="work"]')).toBeNull();
	},
);

screenStory.it(
	"names each empty sidebar list and the empty reading history",
	[chromeScreen({ "notes/plan.md": "# Plan\n" }, "/_board/library")],
	function* ({ click, readText }) {
		yield* eventually(() => expect(readText('#sidebar [aria-label="Active goals"] [data-slot="empty-title"]')).toBe("No active goals"));
		expect(readText('#sidebar [aria-label="Pinned"] [data-slot="empty-title"]')).toBe("No pinned documents");
		expect(readText('#sidebar [aria-label="Pinned"] [data-slot="empty-description"]')).toBe("Pin a document to keep it here.");
		click("#library-open");
		yield* eventually(() => expect(readText('#library-dialog [data-slot="empty-title"]', document)).toBe("No reading history"));
	},
);

screenStory.it(
	"shows a search empty state that can widen the search to files Fleet writes",
	[searchScreen({ "notes.md": "# Notes\n\nPlain text." }, { home: undefined })],
	function* ({ click, findByRole, findElement, readAttribute, readText, typeText }) {
		const field = findElement<HTMLInputElement>('#search-dialog [role="combobox"]', document);
		if (!field) {
			throw new Error("Missing palette input");
		}
		typeText(field, "zzzz");
		yield* eventually(() => expect(readText('#search-dialog [data-slot="empty-title"]', document)).toBe("No matches"));
		expect(readText('#search-dialog [data-slot="empty-description"]', document)).toBe(
			"Nothing in this workspace matches “zzzz”. Try fewer or different words.",
		);
		expect(readText('#search-dialog [data-slot="empty"] button', document)).toBe("Include files Fleet writes");
		expect(findByRole("checkbox", "Include files Fleet writes", document)).not.toBeNull();
		click(findElement('#search-dialog [data-slot="empty"] button', document));
		yield* eventually(() => expect(readAttribute('#search-dialog [role="checkbox"]', "aria-checked", document)).toBe("true"));
	},
);

screenStory.it(
	"shows empty states for a result without feedback and an item without handoffs",
	[
		routedScreen(
			{
				"README.md": "# Workspace\n",
				"result.md": "---\nid: result.bare\nkind: report\nstatus: done\n---\n# A bare result\n",
				"task.md": "---\nid: task.handoff\nkind: task\nstatus: draft\n---\n# A task\n",
			},
			"/_board/item/result.bare/",
		),
	],
	function* ({ navigate, readText }) {
		yield* eventually(() => expect(readText("[data-result-empty]")).toBe("No review requested, no checks listed and no feedback yet."));
		yield* Effect.promise(() => navigate("/_board/handoff?item=task.handoff"));
		yield* eventually(() => expect(readText('#handoff-history [data-slot="empty-title"]')).toBe("No handoffs yet"));
	},
);
