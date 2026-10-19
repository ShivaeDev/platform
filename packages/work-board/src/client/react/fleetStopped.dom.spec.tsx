import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { health } from "#test/diagnostics.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { fleetHealth, stoppedFleet } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";
import { todayIds } from "./todayIds.ts";

expectNoReactWarnings();

const STOPPED = "Fleet isn't running, so agent work and its health are unknown.";
const command = /^work-fleet serve \S+ --port \d+$/u;

screenStory.it(
	"says once on Today that Fleet isn't running and keeps its start command behind one disclosure",
	[screenFiles(fleetWorkspace, { home: "home.md" }), stoppedFleet(), openScreen()],
	function* ({ click, findByRole, findElements, readText }) {
		function stopped() {
			return findElements('[role="status"]', document).filter((status) => status.textContent === STOPPED);
		}
		yield* Effect.promise(() => eventually(() => expect(stopped().map((status) => status.textContent)).toEqual([STOPPED])));
		expect(readText()).not.toContain("127.0.0.1");
		expect(readText()).not.toContain("work-fleet serve");
		expect(findByRole("dialog", "Start Fleet", document)).toBeNull();
		click(findByRole("button", "How to start Fleet"));
		yield* Effect.promise(() => eventually(() => expect(findByRole("dialog", "Start Fleet", document)).not.toBeNull()));
		const shown = findByRole("dialog", "Start Fleet", document)?.querySelector("code")?.textContent ?? "";
		expect(shown).toMatch(command);
		expect(document.body.textContent?.match(/work-fleet serve \S+ --port \d+/gu)).toEqual([shown]);
	},
);

screenStory.it(
	"lists task-file work below the Fleet isn't running panel on Today",
	[
		screenFiles(
			{
				"active.md": "---\nid: task.active\nkind: task\nstatus: active\n---\n# Active task",
				"home.md": "# Workspace notes\n",
			},
			{ home: "home.md" },
		),
		stoppedFleet(),
		openScreen(),
	],
	function* ({ findByRole, findElements, readText }) {
		const progress = `#${todayIds.progress}`;
		yield* Effect.promise(() => eventually(() => expect(readText(`${progress} [data-progress-id="task.active"]`)).toContain("Task file · Active")));
		const panel = findElements(`${progress} [role="status"]`).find((status) => status.textContent === STOPPED)?.parentElement;
		expect(panel?.textContent).toContain("Status comes from the task files, not live Fleet.");
		expect(panel?.contains(findByRole("button", "How to start Fleet") ?? null)).toBe(true);
		expect(readText(`${progress} [data-progress-source="files"] a`)).toBe("Active task");
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
		yield* Effect.promise(() => eventually(() => expect(readText("[data-needs-you] strong")).toBe(nothingNeedsYou)));
		const card = findByRole("article", "Fleet");
		expect(card?.dataset.state).toBe("ready");
		expect(card?.textContent).toContain("Available");
		expect(card?.textContent).not.toContain("Needs attention");
	},
);
