import { expect, it } from "vitest";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { completionMarkdown } from "#board/completionMarkdown.ts";

const ACTION = "Done; PR #7 merged.";

for (const [before, after] of [
	["status: draft # status comment\nnext_action: Work\n", 'status: done # status comment\nnext_action: "Done; PR #7 merged."\n'],
	["status: draft\nnext_action: | # action comment\n  Do the work.\n", 'status: done\nnext_action: "Done; PR #7 merged." # action comment\n'],
	["next_action:\n", 'next_action: "Done; PR #7 merged."\nstatus: done\n'],
	["", 'status: done\nnext_action: "Done; PR #7 merged."\n'],
] as const) {
	it(`edits only completion fields in ${JSON.stringify(before)}`, () => {
		const source = `---\nid: one\nkind: task\n${before}---\n# Authored content\n\nKeep café and 🐕.\n`;
		const expected = `---\nid: one\nkind: task\n${after}---\n# Authored content\n\nKeep café and 🐕.\n`;
		const result = completionMarkdown(source, ACTION);
		expect(result).toBe(expected);
		expect(completionMarkdown(expected, ACTION)).toBe(expected);
		expect(metadataParse(result ?? "").fields).toMatchObject({ nextAction: ACTION, status: "done" });
	});
}

it("preserves a BOM, CRLF, quoted keys and flow mapping bytes", () => {
	const source = '\uFEFF---\r\n{"id": "one", "status": "draft", "next_action": "Work", "kind": "task"}\r\n---\r\nAuthored.\r\n';
	expect(completionMarkdown(source, ACTION)).toBe(source.replace('"draft"', "done").replace('"Work"', JSON.stringify(ACTION)));
	const missing = "---\r\n{id: one,}\r\n---\r\nAuthored.\r\n";
	const result = completionMarkdown(missing, ACTION);
	expect(result).toBe(missing.replace("one,}", 'one,status: done, next_action: "Done; PR #7 merged."}'));
	expect(metadataParse(result ?? "").fields).toMatchObject({ nextAction: ACTION, status: "done" });
});

for (const source of ["Authored without frontmatter.", "---\nid: one\nstatus: [\n---\nAuthored."]) {
	it(`leaves unsupported or invalid completion fields untouched: ${JSON.stringify(source)}`, () => {
		expect(completionMarkdown(source, ACTION)).toBeUndefined();
	});
}

it("replaces aliased completion values while preserving the anchor and authored bytes", () => {
	const source = "---\nid: one\nstatus: &status draft\nnext_action: *status\n---\nAuthored.\n";
	expect(completionMarkdown(source, ACTION)).toBe(source.replace("draft", "done").replace("*status", JSON.stringify(ACTION)));
});
