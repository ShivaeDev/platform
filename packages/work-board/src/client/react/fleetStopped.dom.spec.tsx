import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { health } from "#test/diagnostics.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { deniedClipboard, fleetHealth, stoppedFleet } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const STOPPED = "Fleet isn't running, so agent work and its health are unknown.";
const startCommand = expect.stringMatching(/^npx @shivaedev\/work-fleet serve \S+ --port \d+$/u);
const nowWorkspace = {
	...fleetWorkspace,
	"tasks/delivery.md": "---\nid: task.delivery\nkind: task\nstatus: ready\nowner: codex\n---\n# Deliver the release notes\n",
	"tasks/shipped.md": "---\nid: task.shipped\nkind: task\nstatus: done\nowner: codex\n---\n# Ship the changelog\n",
};

screenStory.it(
	"Today says once that Fleet isn't running and opens its start command only on request",
	[screenFiles(fleetWorkspace, { home: "home.md" }), stoppedFleet(), openScreen()],
	function* ({ fleetStartDialog, fleetStoppedNotices, openFleetStartHelp }) {
		yield* outcomes({
			notices: [fleetStoppedNotices(), [STOPPED]],
			"start command": [fleetStartDialog(), "closed"],
		});

		yield* openFleetStartHelp();

		expect(yield* fleetStartDialog()).toEqual(expect.objectContaining({ command: startCommand }));
	},
);

screenStory.it(
	"Now keeps authored lane counts and leaves Done empty with a note while Fleet isn't running",
	[screenFiles(nowWorkspace, { home: "home.md" }), stoppedFleet(), screenRoute("/_board/work"), openScreen()],
	function* ({ navigationLabels, nowLane, nowLanes }) {
		yield* outcomes({
			done: [
				nowLane("Done in the last 7 days"),
				{ cards: [], count: "none", empty: "none", fold: "never folds", note: "Needs Fleet to show finished work." },
			],
			lanes: [
				nowLanes(),
				[
					"Queued: 3",
					"Working: 0",
					"Reviewing: 0",
					"Waiting on you: 1",
					"Waiting on orchestrator: 0",
					"Waiting on automation: 0",
					"Done in the last 7 days: no count",
				],
			],
			navigation: [navigationLabels(), expect.arrayContaining(["Today, 3 need you", "Now, 4 open tasks"])],
		});
	},
);

screenStory.it(
	"Now's alert says lanes follow the files and opens the Fleet start command",
	[screenFiles(nowWorkspace, { home: "home.md" }), stoppedFleet(), screenRoute("/_board/work"), openScreen()],
	function* ({ fleetAlert, fleetStartDialog, openFleetStartHelp }) {
		expect(yield* fleetAlert()).toEqual([`Lanes show the status written in each file. ${STOPPED}How to start Fleet`]);

		yield* openFleetStartHelp();

		expect(yield* fleetStartDialog()).toEqual(expect.objectContaining({ command: startCommand }));
	},
);

screenStory.it(
	"Today lists work by its authored status under a panel that says Fleet isn't running",
	[
		screenFiles(
			{ "active.md": "---\nid: task.active\nkind: task\nstatus: ready\n---\n# Ready task", "home.md": "# Workspace notes\n" },
			{ home: "home.md" },
		),
		stoppedFleet(),
		openScreen(),
	],
	function* ({ fleetStoppedPanels, inProgressList }) {
		yield* outcomes({
			"in progress": [inProgressList(), expect.objectContaining({ rows: [{ badge: "Ready", id: "task.active", pr: "none", title: "Ready task" }] })],
			panel: [
				fleetStoppedPanels(),
				[{ explains: ["These show the status written in each task, not what Fleet reports."], help: ["How to start Fleet"], notice: STOPPED }],
			],
		});
	},
);

screenStory.it(
	"System's Fleet card follows Fleet health when Fleet's waiting counts disagree with Needs you",
	[
		screenFiles({ "home.md": "# Workspace notes\n" }, { home: "home.md" }),
		fleetHealth({ ...health, observedAt: Effect.runSync(Clock.currentTimeMillis), waiting: { automation: 1, maintainer: 2, orchestrator: 3 } }),
		screenRoute("/_board/system"),
		openScreen(),
	],
	function* ({ systemCard }) {
		expect(yield* systemCard("fleet")).toEqual(
			expect.objectContaining({ facts: expect.objectContaining({ "Needs you": "0" }), label: "Available", state: "ready" }),
		);
	},
);

screenStory.it(
	"Copy puts the Fleet start command on the clipboard and says it copied",
	[screenFiles(fleetWorkspace, { home: "home.md" }), stoppedFleet(), openScreen()],
	function* ({ clipboardText, copyFleetStartCommand, fleetStartDialog, openFleetStartHelp }) {
		yield* openFleetStartHelp();
		expect(yield* fleetStartDialog()).toEqual(expect.objectContaining({ copyStatus: "" }));

		yield* copyFleetStartCommand();

		yield* outcomes({
			clipboard: [clipboardText(), startCommand],
			dialog: [fleetStartDialog(), { command: startCommand, copyStatus: "Copied.", field: "not selected" }],
		});
	},
);

screenStory.it(
	"Copy selects the Fleet start command for the reader when the clipboard refuses it",
	[deniedClipboard(), screenFiles(fleetWorkspace, { home: "home.md" }), stoppedFleet(), openScreen()],
	function* ({ copyFleetStartCommand, fleetStartDialog, openFleetStartHelp }) {
		yield* openFleetStartHelp();
		expect(yield* fleetStartDialog()).toEqual(expect.objectContaining({ copyStatus: "" }));

		yield* copyFleetStartCommand();

		expect(yield* fleetStartDialog()).toEqual({
			command: startCommand,
			copyStatus: "Couldn't copy automatically. The command is selected, so copy it yourself.",
			field: "focused and selected",
		});
	},
);

screenStory.it(
	"System's header tells readers where Pause updates lives",
	[screenFiles({ "home.md": "# Release plans\n" }, { home: "home.md" }), stoppedFleet(), screenRoute("/_board/system"), openScreen()],
	function* ({ systemHeader }) {
		expect(yield* systemHeader()).toContain("To stop that, open Settings, the gear at the top right, and choose Pause updates.");
	},
);
