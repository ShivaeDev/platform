import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveForm } from "#test/answerTraits.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { deniedClipboard } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const CHANGED_ITEM = `${EDGE_ATTENTION_SOURCE}Changed premise.\n`;

screenStory.it(
	"Prepare handoff with a blank goal and a 201-character agent name marks both fields, says what to do, and saves nothing",
	[liveForm("handoff")],
	function* ({ fillHandoff, handoffField, handoffStatus, pressPrepareHandoff, readSessionFiles }) {
		yield* fillHandoff("Agent name", "x".repeat(201));
		yield* fillHandoff("Goal", " ");

		yield* pressPrepareHandoff();

		yield* outcomes([
			["Agent name", () => handoffField("Agent name"), expect.objectContaining({ problem: expect.stringContaining("200") })],
			["Goal", () => handoffField("Goal"), expect.objectContaining({ problem: expect.stringMatching(/.+/u) })],
			["saved", () => readSessionFiles("handoffs"), []],
			["status", () => handoffStatus(), "Fill in the marked fields, then prepare the handoff."],
		]);
	},
);

screenStory.it(
	"correcting the marked handoff fields clears their problems and the status line",
	[liveForm("handoff")],
	function* ({ fillHandoff, handoffField, handoffStatus, pressPrepareHandoff }) {
		yield* fillHandoff("Agent name", "x".repeat(201));
		yield* fillHandoff("Goal", " ");
		yield* pressPrepareHandoff();
		expect(yield* handoffStatus()).toBe("Fill in the marked fields, then prepare the handoff.");

		yield* fillHandoff("Goal", "Review the direction");
		yield* fillHandoff("Agent name", "agent-local");

		yield* outcomes([
			["Agent name", () => handoffField("Agent name"), expect.objectContaining({ problem: "" })],
			["Goal", () => handoffField("Goal"), expect.objectContaining({ problem: "" })],
			["status", () => handoffStatus(), ""],
		]);
	},
);

screenStory.it(
	"an outside edit to another file leaves the handoff draft as written and says nothing changed",
	[liveForm("handoff")],
	function* ({ fillHandoff, handoffField, handoffStatus, outsideEditorWrites }) {
		yield* fillHandoff("Goal", "Keep my direction");

		yield* outsideEditorWrites("unrelated.md", "# Another file");

		yield* outcomes([
			["goal", () => handoffField("Goal"), expect.objectContaining({ text: "Keep my direction" })],
			["status", () => handoffStatus(), ""],
		]);
	},
);

screenStory.it(
	"an outside edit to the item shows its new text above the handoff form, keeps the draft, and says the source changed",
	[liveForm("handoff")],
	function* ({ fillHandoff, handoffContext, handoffField, handoffStatus, outsideEditorWrites }) {
		yield* fillHandoff("Goal", "Keep my direction");
		expect(yield* handoffContext()).not.toContain("Changed premise.");

		yield* outsideEditorWrites("item.md", CHANGED_ITEM);

		yield* outcomes([
			["context", () => handoffContext(), expect.stringContaining("Changed premise.")],
			["goal", () => handoffField("Goal"), expect.objectContaining({ text: "Keep my direction" })],
			["status", () => handoffStatus(), expect.stringContaining("Source changed since this draft")],
		]);
	},
);

screenStory.it(
	"the first Prepare handoff after the item changed moves the draft to the new version and saves nothing",
	[liveForm("handoff")],
	function* ({ fillHandoff, handoffStatus, outsideEditorWrites, pressPrepareHandoff, readSessionFiles }) {
		yield* fillHandoff("Agent name", "agent-local");
		yield* fillHandoff("Goal", "Keep my direction");
		yield* outsideEditorWrites("item.md", CHANGED_ITEM);

		yield* pressPrepareHandoff();

		yield* outcomes([
			["saved", () => readSessionFiles("handoffs"), []],
			["status", () => handoffStatus(), expect.stringContaining("Updated to the item's new version")],
		]);
	},
);

screenStory.it(
	"pressing Prepare handoff again after the move saves the handoff with the item's changed text",
	[liveForm("handoff")],
	function* ({ fillHandoff, handoffStatus, outsideEditorWrites, pressPrepareHandoff, readSessionFiles }) {
		yield* fillHandoff("Agent name", "agent-local");
		yield* fillHandoff("Goal", "Keep my direction");
		yield* outsideEditorWrites("item.md", CHANGED_ITEM);
		yield* pressPrepareHandoff();
		expect(yield* readSessionFiles("handoffs")).toEqual([]);

		yield* pressPrepareHandoff();

		yield* outcomes([
			["saved", () => readSessionFiles("handoffs"), [expect.stringContaining("Changed premise.")]],
			["status", () => handoffStatus(), expect.stringContaining("Saved handoffs/")],
		]);
	},
);

screenStory.it(
	"preparing a handoff keeps the form filled in, puts focus on the prompt, and says to copy it in the form's one status line",
	[liveForm("handoff")],
	function* ({ fillHandoff, focusPrepareHandoff, handoffField, handoffStatus, handoffStatusLines, preparedPrompt, pressPrepareHandoff }) {
		yield* fillHandoff("Agent name", "agent-local");
		yield* fillHandoff("Goal", "Fix focus");
		yield* focusPrepareHandoff();
		expect(yield* preparedPrompt()).toBe("none");

		yield* pressPrepareHandoff();

		yield* outcomes([
			["Agent name", () => handoffField("Agent name"), expect.objectContaining({ text: "agent-local" })],
			["prompt", () => preparedPrompt(), expect.objectContaining({ focused: true, text: expect.stringContaining("Record receipt") })],
			["status", () => handoffStatus(), expect.stringMatching(/Saved handoffs\/.*Copy the prompt below into your agent session/su)],
			["status lines", () => handoffStatusLines(), ["handoff-status"]],
		]);
	},
);

screenStory.it(
	"a prepared handoff joins the list of handoffs as prepared just now",
	[liveForm("handoff")],
	function* ({ fillHandoff, handoffsSoFar, pressPrepareHandoff }) {
		yield* fillHandoff("Agent name", "agent-local");
		yield* fillHandoff("Goal", "Fix focus");
		expect(yield* handoffsSoFar()).toBe("No handoffs yet");

		yield* pressPrepareHandoff();

		expect(yield* handoffsSoFar()).toEqual([expect.stringContaining("prepared just now")]);
	},
);

screenStory.it(
	"Copy prompt puts the prepared prompt on the clipboard and tells the reader to paste it",
	[liveForm("handoff")],
	function* ({ clipboardText, copyHandoffPrompt, fillHandoff, handoffStatus, preparedPrompt, pressPrepareHandoff }) {
		yield* fillHandoff("Agent name", "agent-local");
		yield* fillHandoff("Goal", "Fix focus");
		yield* pressPrepareHandoff();
		const prepared = yield* preparedPrompt();

		yield* copyHandoffPrompt();

		yield* outcomes([
			["clipboard", () => clipboardText(), prepared === "none" ? "no prompt was prepared" : prepared.text],
			["status", () => handoffStatus(), "Copied. Paste it into your agent session."],
		]);
	},
);

screenStory.it(
	"when the clipboard refuses, Copy prompt selects the whole prompt and says it is selected",
	[deniedClipboard(), liveForm("handoff")],
	function* ({ copyHandoffPrompt, fillHandoff, handoffStatus, preparedPrompt, pressPrepareHandoff }) {
		yield* fillHandoff("Agent name", "agent-local");
		yield* fillHandoff("Goal", "Fix focus");
		yield* pressPrepareHandoff();

		yield* copyHandoffPrompt();

		yield* outcomes([
			["prompt", () => preparedPrompt(), expect.objectContaining({ selected: "all" })],
			["status", () => handoffStatus(), expect.stringContaining("selected")],
		]);
	},
);
