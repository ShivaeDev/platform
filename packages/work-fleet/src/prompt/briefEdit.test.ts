import { expect, it } from "vitest";
import { briefEditPrompt } from "./briefEdit.ts";

it("brief correction names added, removed and changed criteria before the full new brief", () => {
	const before = "---\nkind: task\ncriteria: [{ id: old, text: Old criterion. }, { id: same, text: Before. }]\n---\nOld body.";
	const after = "---\nkind: task\ncriteria: [{ id: new, text: New criterion. }, { id: same, text: After. }]\n---\nNew body.";
	expect(briefEditPrompt(before, after)).toBe(
		[
			"Fleet approved an edited brief. Apply this correction to your running work.",
			"What changed:",
			"Criterion old: Old criterion. -> (removed)",
			"Criterion same: Before. -> After.",
			"Criterion new: (added) -> New criterion.",
			"Previous title/body excerpt:\nOld body.",
			"New title/body excerpt:\nNew body.",
			"Full new brief:",
			after,
		].join("\n\n"),
	);
});
