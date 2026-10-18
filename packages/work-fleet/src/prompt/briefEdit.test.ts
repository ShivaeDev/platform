import { expect, it } from "vitest";
import { briefEditPrompt } from "./briefEdit.ts";

it("brief correction names added, removed and changed criteria before the full new brief", () => {
	const before = "---\nkind: task\ncriteria: [{ id: old, text: Old criterion. }, { id: same, text: Before. }]\n---\nOld body.";
	const after = "---\nkind: task\ncriteria: [{ id: new, text: New criterion. }, { id: same, text: After. }]\n---\nNew body.";
	const prompt = briefEditPrompt(before, after);
	expect(prompt).toContain("Criterion old: Old criterion. -> (removed)");
	expect(prompt).toContain("Criterion same: Before. -> After.");
	expect(prompt).toContain("Criterion new: (added) -> New criterion.");
	expect(prompt).toContain("Old body.");
	expect(prompt.endsWith(after)).toBe(true);
	expect(prompt.indexOf("Criterion old:")).toBeLessThan(prompt.indexOf(after));
});
