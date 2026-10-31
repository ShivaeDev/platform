import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const FOCUS_TASK = {
	"task.md": "---\nid: task.focus\nkind: task\nstatus: draft\nnext_action: Inspect focus\n---\n# Focus\n\nKeep the source readable.\n",
};
const SHIPPED_TASK = {
	"task.md": "---\nid: task.shipped\nkind: task\nstatus: done\nowner: codex\nnext_action: Done; PR #395 merged.\n---\n# Shipped work\n",
};

screenStory.it(
	"the handoff page is titled after the item, links back to it, shows its text, and starts the form from the item's goal and next step",
	[routedScreen(FOCUS_TASK, "/_board/handoff?item=task.focus", { writable: true })],
	function* ({ handoffButtons, handoffContext, handoffFields, handoffNotice, handoffPageHeader, handoffStatus, handoffsSoFar }) {
		yield* outcomes([
			["buttons", () => handoffButtons(), ["Prepare handoff", "Preview file", "Clear draft"]],
			["context", () => handoffContext(), expect.stringContaining("Keep the source readable.")],
			["fields", () => handoffFields(), ["Agent name: ", "Goal: Focus", "Constraints (optional): ", "Next step: Inspect focus"]],
			["handoffs so far", () => handoffsSoFar(), "No handoffs yet"],
			[
				"header",
				() => handoffPageHeader(),
				{ actions: [{ href: "/_board/item/task.focus/", name: "Back to item", role: "link" }], title: "Hand off: Focus" },
			],
			["notice", () => handoffNotice(), "none"],
			["status", () => handoffStatus(), ""],
		]);
	},
);

screenStory.it(
	"a done item's handoff names its owner as the agent and leaves the old next step empty for a new one",
	[routedScreen(SHIPPED_TASK, "/_board/handoff?item=task.shipped", { writable: true })],
	function* ({ handoffField }) {
		yield* outcomes([
			["Agent name", () => handoffField("Agent name"), expect.objectContaining({ text: "codex" })],
			["Next step", () => handoffField("Next step"), expect.objectContaining({ placeholder: "What should the agent do first?", text: "" })],
		]);
	},
);

screenStory.it(
	"clearing a handoff draft puts the item's goal back and says saved handoffs are unchanged",
	[routedScreen(SHIPPED_TASK, "/_board/handoff?item=task.shipped", { writable: true })],
	function* ({ clearHandoffDraft, fillHandoff, handoffField, handoffStatus }) {
		yield* fillHandoff("Goal", "A different direction");
		expect(yield* handoffField("Goal")).toEqual(expect.objectContaining({ text: "A different direction" }));

		yield* clearHandoffDraft();

		yield* outcomes([
			["goal", () => handoffField("Goal"), expect.objectContaining({ text: "Shipped work" })],
			["status", () => handoffStatus(), "Draft cleared. Saved handoffs are unchanged."],
		]);
	},
);

screenStory.it(
	"an item without a heading is handed off under its ID, which also becomes the goal",
	[routedScreen({ "task.md": "---\nid: task.plain\nkind: task\nstatus: draft\n---\nNo heading here.\n" }, "/_board/handoff?item=task.plain")],
	function* ({ handoffField, handoffPageHeader }) {
		yield* outcomes([
			["goal", () => handoffField("Goal"), expect.objectContaining({ text: "task.plain" })],
			["title", () => handoffPageHeader(), expect.objectContaining({ title: "Hand off: task.plain" })],
		]);
	},
);

screenStory.it(
	"a read-only Board says saving handoffs is off and keeps Prepare handoff disabled",
	[routedScreen(FOCUS_TASK, "/_board/handoff?item=task.focus")],
	function* ({ handoffButtons, handoffNotice }) {
		yield* outcomes([
			["buttons", () => handoffButtons(), ["Prepare handoff (disabled)", "Preview file", "Clear draft"]],
			["notice", () => handoffNotice(), "Read-onlySaving handoffs is turned off on this Board."],
		]);
	},
);
