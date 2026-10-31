import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const PLANNED = '---\nid: goal.admin\nkind: goal\nstatus: draft\nowner: marvin\nnext_action: "Later: design the admin system"\n---\n# Admin system\n';
const ACTIVE = "---\nid: goal.launch\nkind: goal\nstatus: ready\nowner: claude\nnext_action: Ship the launch\n---\n# Launch\n";
const personOwnedWork = routedScreen({ "goals/admin.md": PLANNED, "home.md": "# Home" }, "/");
const oneGoalDeferred = routedScreen(
	{ "goals/admin.md": PLANNED.replace("status: draft", "status: deferred"), "goals/launch.md": ACTIVE, "home.md": "# Home" },
	"/",
);

screenStory.it(
	"deferring person-owned work moves it from Needs you into a folded Later section on Today",
	[personOwnedWork],
	function* ({ changeSource, inboxBadge, laterSection, needsYouItems }) {
		yield* outcomes([
			["later", () => laterSection(), "absent"],
			["needs you", () => needsYouItems(), ["goal.admin"]],
		]);

		yield* changeSource("goals/admin.md", PLANNED.replace("status: draft", "status: deferred"));

		yield* outcomes([
			["badge", () => inboxBadge(), "0"],
			["later", () => laterSection(), { folded: true, heading: "Later1", items: [expect.stringContaining("Later: design the admin system")] }],
			["needs you", () => needsYouItems(), []],
		]);
	},
);

screenStory.it(
	"dropping person-owned work removes it from Needs you and every needs-you count without listing it under Later",
	[personOwnedWork],
	function* ({ changeSource, inboxBadge, laterSection, needsYouItems, todayStripText }) {
		yield* outcomes([
			["badge", () => inboxBadge(), "1"],
			["needs you", () => needsYouItems(), ["goal.admin"]],
		]);

		yield* changeSource("goals/admin.md", PLANNED.replace("status: draft", "status: dropped"));

		yield* outcomes([
			["badge", () => inboxBadge(), "0"],
			["later", () => laterSection(), "absent"],
			["needs you", () => needsYouItems(), []],
			["strip", () => todayStripText(), expect.stringContaining("0 need you")],
		]);
	},
);

screenStory.it(
	"Today counts and shows only the active goal while Later lists the deferred one",
	[oneGoalDeferred],
	function* ({ laterSection, todayGoalIds, todayStripText }) {
		yield* outcomes([
			["goals", () => todayGoalIds(), ["goal.launch"]],
			["later", () => laterSection(), expect.objectContaining({ items: [expect.stringContaining("Later: design the admin system")] })],
			["strip", () => todayStripText(), expect.stringMatching(/1 active goal(?!s)/u)],
		]);
	},
);

screenStory.it(
	"the Goals page lists the active goal and folds the deferred one under Deferred goals",
	[oneGoalDeferred],
	function* ({ activeGoalIds, deferredGoalSection, goalsPageSummary, navigate }) {
		yield* navigate("/_board/goals");

		yield* outcomes([
			["active", () => activeGoalIds(), ["goal.launch"]],
			["deferred", () => deferredGoalSection(), { goals: ["goal.admin"], heading: "Deferred goals" }],
			["summary", () => goalsPageSummary(), "1 active goal"],
		]);
	},
);
