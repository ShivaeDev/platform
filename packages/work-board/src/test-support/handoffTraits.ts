import { symlinkSync } from "node:fs";
import { Effect } from "effect";
import { boardStory, projectFiles } from "./boardStory.ts";
import { projectPath, publicationSetup } from "./publicationFaults.ts";
import { outsideFolder } from "./publicationTraits.ts";
import { served } from "./storyEngine.ts";
import { handoffInput } from "./storyResponses.ts";
import { aHandoffTask } from "./storyTraits.ts";

export const KEYBOARD_TASK =
	"---\r\nid: task.keyboard\r\nkind: task\r\nstatus: ready\r\nnext_action: Verify focus before changing the implementation\r\ncriteria:\r\n  - id: focus\r\n    text: Escape returns focus to the opening control\r\n---\r\n# Keyboard focus\r\n\r\nKeep the source readable.\r\n";

export const HANDOFF_RECORD = "handoffs/handoff.keyboard.1.md";

export function aKeyboardTask(responses = true) {
	return aHandoffTask(KEYBOARD_TASK, "items/keyboard.md", responses);
}

// 256 KiB + 1 byte of UTF-8 in fewer than 256 Ki characters, so only a byte count refuses it.
function oversized() {
	const remaining = 256 * 1024 + 1 - new TextEncoder().encode(KEYBOARD_TASK).length;
	return KEYBOARD_TASK + "界".repeat(Math.floor(remaining / 3)) + "x".repeat(remaining % 3);
}

export function anOversizedKeyboardTask() {
	return boardStory.traits(
		aKeyboardTask(),
		projectFiles({ "items/keyboard.md": oversized() }, "task.keyboard's text is one byte over 256 KiB of UTF-8"),
	);
}

export function aPreparedHandoff() {
	return boardStory.trait("reader", "the maintainer has prepared handoff.keyboard.1 for agent-codex", function* (engine) {
		const { client } = served(engine);
		const draft = yield* handoffInput(client);
		publicationSetup(engine).handoffDraft = draft;
		yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
	});
}

export function handoffsFolderLinkedOutside() {
	return boardStory.trait("project", "handoffs/ is a link to another folder", function* (engine) {
		const outside = yield* outsideFolder(engine);
		symlinkSync(outside.root, projectPath(engine, "handoffs"));
	});
}
