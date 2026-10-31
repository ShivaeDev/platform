import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory } from "#test/boardStory.ts";
import {
	aKeyboardTask,
	anOversizedKeyboardTask,
	aPreparedHandoff,
	HANDOFF_RECORD,
	handoffsFolderLinkedOutside,
	KEYBOARD_TASK,
} from "#test/handoffTraits.ts";

const CHANGED = "conflict: This handoff identity moved, is duplicated or records different direction.";

boardStory.it(
	"preparing a handoff records task.keyboard's exact text as a requested handoff whose prompt names its record file, and leaves the task unchanged",
	[aKeyboardTask()],
	function* ({ fileText, prepareHandoff, promptedRecordFile }) {
		const handoff = yield* prepareHandoff();

		yield* outcomes({
			"file the prompt names": [promptedRecordFile(handoff.prompt), HANDOFF_RECORD],
			receipt: [Effect.succeed(handoff.handoff.state), "requested"],
			"reviewed text": [Effect.succeed(handoff.context), KEYBOARD_TASK],
			task: [fileText("items/keyboard.md"), KEYBOARD_TASK],
		});
	},
);

boardStory.it("preparing the same handoff again returns the recorded handoff", [aKeyboardTask()], function* ({ prepareHandoff }) {
	const handoff = yield* prepareHandoff();

	expect(yield* prepareHandoff()).toEqual(handoff);
});

boardStory.it(
	"the handoff page offers a prepared handoff's prompt to copy, written for the current task",
	[aKeyboardTask(), aPreparedHandoff()],
	function* ({ handoffPage }) {
		expect((yield* handoffPage()).entries).toEqual([
			{ copyPrompt: true, id: "handoff.keyboard.1", receipt: "requested", writtenFor: "current version" },
		]);
	},
);

boardStory.it(
	"retrying a handoff the agent acknowledged after its task was deleted returns the acknowledgement and keeps the edited record byte for byte",
	[aKeyboardTask(), aPreparedHandoff()],
	function* ({ agentReportsReceipt, attemptHandoff, fileText, handoffHistory, removeTaskSource }) {
		yield* agentReportsReceipt("acknowledged", "agent_extra: ordinary file edits");
		yield* removeTaskSource();
		const record = yield* fileText(HANDOFF_RECORD);

		const retried = yield* attemptHandoff();

		yield* outcomes({
			history: [handoffHistory(), { records: ["handoff.keyboard.1 acknowledged by agent-codex"], unreadable: [] }],
			record: [fileText(HANDOFF_RECORD), record],
			retry: [Effect.succeed(retried), "prepared"],
		});
	},
);

boardStory.it(
	"after a restart, an acknowledged handoff whose task was deleted is still listed and shown as written for an earlier version",
	[aKeyboardTask(), aPreparedHandoff()],
	function* ({ agentReportsReceipt, handoffHistory, handoffPage, removeTaskSource, restart }) {
		yield* agentReportsReceipt("acknowledged");
		yield* removeTaskSource();

		yield* restart();

		yield* outcomes({
			history: [handoffHistory(), { records: ["handoff.keyboard.1 acknowledged by agent-codex"], unreadable: [] }],
			page: [
				Effect.map(handoffPage(), (page) => page.entries),
				[{ copyPrompt: true, id: "handoff.keyboard.1", receipt: "acknowledged", writtenFor: "earlier version" }],
			],
		});
	},
);

for (const state of ["rejected", "unavailable"]) {
	boardStory.it(
		`an agent's ${state} receipt edited into the handoff record is read as ${state}`,
		[aKeyboardTask(), aPreparedHandoff()],
		function* ({ agentReportsReceipt, handoffHistory }) {
			expect((yield* handoffHistory()).records).toEqual(["handoff.keyboard.1 requested"]);

			yield* agentReportsReceipt(state);

			expect((yield* handoffHistory()).records).toEqual([`handoff.keyboard.1 ${state} by agent-codex`]);
		},
	);
}

boardStory.it(
	"preparing a handoff reviewed before its task changed is refused",
	[aKeyboardTask()],
	function* ({ attemptHandoff, edited, reviewHandoff }) {
		yield* reviewHandoff();
		yield* edited("items/keyboard.md", `${KEYBOARD_TASK}Changed by the agent.\n`);

		expect(yield* attemptHandoff()).toBe("precondition failed: The source changed or moved. Keep your draft and review it again.");
	},
);

for (const change of [{ goal: "Different direction" }, { recipient: "other-agent" }]) {
	boardStory.it(
		`preparing handoff.keyboard.1 again with a different ${Object.keys(change).join("")} is refused`,
		[aKeyboardTask(), aPreparedHandoff()],
		function* ({ attemptHandoff }) {
			expect(yield* attemptHandoff(change)).toBe(CHANGED);
		},
	);
}

boardStory.it(
	"preparing a handoff whose record was moved is refused and the moved record keeps its direction",
	[aKeyboardTask(), aPreparedHandoff()],
	function* ({ attemptHandoff, fileText, moveHandoffRecord }) {
		yield* moveHandoffRecord("moved.md");

		yield* outcomes({
			"moved record": [fileText("moved.md"), expect.stringContaining("goal: Fix keyboard focus")],
			retry: [attemptHandoff(), CHANGED],
		});
	},
);

boardStory.it(
	"a read-only Board refuses to prepare a handoff and leaves the task unchanged",
	[aKeyboardTask(false)],
	function* ({ attemptHandoff, fileText }) {
		yield* outcomes({
			handoff: [attemptHandoff(), "forbidden: Restart with --responses to enable local response/handoff writes."],
			task: [fileText("items/keyboard.md"), KEYBOARD_TASK],
		});
	},
);

boardStory.it("a read-only Board's handoff page says saving handoffs is turned off", [aKeyboardTask(false)], function* ({ handoffPage }) {
	expect((yield* handoffPage()).notices).toEqual(["Saving handoffs is turned off on this Board."]);
});

boardStory.it(
	"a broken handoff file is listed as unreadable beside the readable handoff",
	[aKeyboardTask(), aPreparedHandoff()],
	function* ({ edited, handoffHistory }) {
		yield* edited("handoffs/broken.md", "---\nhandoff: [broken\n---\nFeedback\n");

		expect(yield* handoffHistory()).toEqual({ records: ["handoff.keyboard.1 requested"], unreadable: ["handoffs/broken.md"] });
	},
);

boardStory.it(
	"a copied handoff record leaves no handoff selected and lists both copies as unreadable",
	[aKeyboardTask(), aPreparedHandoff()],
	function* ({ copyHandoffRecord, handoffHistory }) {
		yield* copyHandoffRecord("duplicate.md");

		expect(yield* handoffHistory()).toEqual({ records: [], unreadable: expect.arrayContaining([HANDOFF_RECORD, "duplicate.md"]) });
	},
);

boardStory.it(
	"a handoffs/ linked to another folder makes the handoff unavailable and writes nothing there",
	[aKeyboardTask(), handoffsFolderLinkedOutside()],
	function* ({ attemptHandoff, outsideFolderEntries }) {
		yield* outcomes({
			handoff: [
				attemptHandoff(),
				"unavailable: The local record could not be recorded. Keep the draft and retry after checking local filesystem access.",
			],
			"other folder": [outsideFolderEntries(), []],
		});
	},
);

boardStory.it(
	"a task one byte over 256 KiB of UTF-8 cannot be reviewed for a handoff",
	[anOversizedKeyboardTask()],
	function* ({ handoffSourceFor }) {
		expect(yield* handoffSourceFor("task.keyboard")).toBe("bad request: Handoff context is limited to 256 KiB. Choose a focused item.");
	},
);
