import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { health } from "#test/diagnostics.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { deniedClipboard, fleetHealth, stoppedFleet } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";
import { todayIds } from "./todayIds.ts";

expectNoReactWarnings();

const STOPPED = "Fleet isn't running, so agent work and its health are unknown.";
const command = /^npx @shivaedev\/work-fleet serve \S+ --port \d+$/u;
const COMMAND = "textarea[aria-label='Command to start Fleet']";

screenStory.it(
	"says once on Today that Fleet isn't running and keeps its start command behind one disclosure",
	[screenFiles(fleetWorkspace, { home: "home.md" }), stoppedFleet(), openScreen()],
	function* ({ click, findByRole, findElements, readText }) {
		function stopped() {
			return findElements('[role="status"]', document).filter((status) => status.textContent === STOPPED);
		}
		yield* eventually(() => expect(stopped().map((status) => status.textContent)).toEqual([STOPPED]));
		expect(readText()).not.toContain("127.0.0.1");
		expect(findElements(COMMAND, document)).toEqual([]);
		expect(findByRole("dialog", "Start Fleet", document)).toBeNull();
		click(findByRole("button", "How to start Fleet"));
		yield* eventually(() => expect(findByRole("dialog", "Start Fleet", document)).not.toBeNull());
		expect(findElements<HTMLTextAreaElement>(COMMAND, document).map((field) => field.value)).toEqual([expect.stringMatching(command)]);
	},
);

screenStory.it(
	"keeps Now's Done lane free of guesses, keeps authored lane counts and points to the one Fleet start path while Fleet isn't running",
	[
		screenFiles(
			{
				...fleetWorkspace,
				"tasks/delivery.md": "---\nid: task.delivery\nkind: task\nstatus: ready\nowner: codex\n---\n# Deliver the release notes\n",
				"tasks/shipped.md": "---\nid: task.shipped\nkind: task\nstatus: done\nowner: codex\n---\n# Ship the changelog\n",
			},
			{ home: "home.md" },
		),
		stoppedFleet(),
		screenRoute("/_board/work"),
		openScreen(),
	],
	function* ({ click, findByRole, findElement, findElements, readText }) {
		const done = 'section[aria-label="Done in the last 7 days"]';
		yield* eventually(() => expect(readText(done)).toBe("Done in the last 7 daysNeeds Fleet to show finished work."));
		expect(findElement(`${done} [data-item]`)).toBeNull();
		expect(findElement(`${done} [aria-expanded]`)).toBeNull();
		expect(findElements(".work-column").map((lane) => [lane.getAttribute("aria-label"), lane.querySelector(".work-count")?.textContent])).toEqual([
			["Queued", "3"],
			["Working", "0"],
			["Reviewing", "0"],
			["Waiting on you", "1"],
			["Waiting on orchestrator", "0"],
			["Waiting on automation", "0"],
			["Done in the last 7 days", undefined],
		]);
		expect(findElements("#primary-navigation a").map((link) => link.getAttribute("aria-label"))).toContain("Today, 3 need you");
		expect(findElements("#primary-navigation a").map((link) => link.getAttribute("aria-label"))).toContain("Now, 4 open tasks");
		expect(readText('[data-slot="alert"]')).toBe(`Lanes show the status written in each file. ${STOPPED}How to start Fleet`);
		click(findByRole("button", "How to start Fleet"));
		yield* eventually(() => expect(findByRole("dialog", "Start Fleet", document)).not.toBeNull());
		expect(findElements<HTMLTextAreaElement>(COMMAND, document).map((field) => field.value)).toEqual([expect.stringMatching(command)]);
	},
);

screenStory.it(
	"lists work by the status written in each task below the Fleet isn't running panel on Today",
	[
		screenFiles(
			{
				"active.md": "---\nid: task.active\nkind: task\nstatus: ready\n---\n# Ready task",
				"home.md": "# Workspace notes\n",
			},
			{ home: "home.md" },
		),
		stoppedFleet(),
		openScreen(),
	],
	function* ({ findByRole, findElements, readText }) {
		const progress = `#${todayIds.progress}`;
		yield* eventually(() => expect(readText(`${progress} [data-progress-id="task.active"]`)).toContain("Ready"));
		expect(readText(`${progress} [data-progress-id="task.active"]`)).not.toContain("Task file");
		const panel = findElements(`${progress} [role="status"]`).find((status) => status.textContent === STOPPED)?.parentElement;
		expect(panel?.textContent).toContain("These show the status written in each task, not what Fleet reports.");
		expect(panel?.contains(findByRole("button", "How to start Fleet") ?? null)).toBe(true);
		expect(readText(`${progress} [data-progress-source="files"] a`)).toBe("Ready task");
	},
);

screenStory.it(
	"keeps the System Fleet card's state to Fleet health when Fleet's waiting counts disagree with what needs you",
	[
		screenFiles({ "home.md": "# Workspace notes\n" }, { home: "home.md" }),
		fleetHealth({ ...health, observedAt: Effect.runSync(Clock.currentTimeMillis), waiting: { automation: 1, maintainer: 2, orchestrator: 3 } }),
		screenRoute("/_board/system"),
		openScreen(),
	],
	function* ({ findByRole, readText }) {
		const nothingNeedsYou = "0";
		yield* eventually(() => expect(readText("[data-needs-you] strong")).toBe(nothingNeedsYou));
		const card = findByRole("article", "Fleet");
		expect(card?.dataset.state).toBe("ready");
		expect(card?.textContent).toContain("Available");
		expect(card?.textContent).not.toContain("Needs attention");
	},
);

for (const [clipboard, traits, status] of [
	["accepts it", [], "Copied."],
	["refuses it", [deniedClipboard()], "Couldn't copy automatically. The command is selected, so copy it yourself."],
] as const) {
	screenStory.it(
		`copies the Fleet start command, or selects it when the clipboard ${clipboard}`,
		[...traits, screenFiles(fleetWorkspace, { home: "home.md" }), stoppedFleet(), openScreen()],
		function* ({ click, findByRole, findElement, readFocus, readText }) {
			yield* eventually(() => expect(findByRole("button", "How to start Fleet")).not.toBeNull());
			click(findByRole("button", "How to start Fleet"));
			yield* eventually(() => expect(findElement(COMMAND, document)).not.toBeNull());
			const field = findElement<HTMLTextAreaElement>(COMMAND, document);
			click(findByRole("button", "Copy the command to start Fleet", document));
			yield* eventually(() => expect(readText("[role='dialog'] [data-copy-status]", document)).toBe(status));
			if (traits.length === 0) {
				expect(yield* Effect.promise(() => navigator.clipboard.readText())).toBe(field?.value);
			} else {
				expect(readFocus()).toBe(field);
				expect([field?.selectionStart, field?.selectionEnd]).toEqual([0, field?.value.length]);
			}
		},
	);
}

screenStory.it(
	"tells System readers where Pause updates lives",
	[screenFiles({ "home.md": "# Release plans\n" }, { home: "home.md" }), stoppedFleet(), screenRoute("/_board/system"), openScreen()],
	function* ({ findByRole, readText }) {
		yield* eventually(() => expect(readText("#doc [data-page-header]")).toContain("Pause updates"));
		expect(readText("#doc [data-page-header]")).toContain("To stop that, open Settings, the gear at the top right, and choose Pause updates.");
		expect(findByRole("button", "Settings", document)).not.toBeNull();
	},
);
