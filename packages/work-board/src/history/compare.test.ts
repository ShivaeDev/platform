import { expect, it } from "vitest";
import { historyFixture } from "#test/historyFixture.ts";
import { compareHistory } from "./compare.ts";
import { historyHtml } from "./html.ts";

it("compares source bytes and explicit fields without interpreting revisions or decision edits as acceptance", () => {
	const before = historyFixture({
		"a.md": "---\nid: a\nkind: decision\nstatus: open\nowner: agent\nevidence: [{source: old.md}]\n---\n# Option A",
		"same.md": "# Same",
	});
	const after = historyFixture({
		"a.md": "---\nid: a\nkind: decision\nstatus: done\nowner: person\nevidence: [{source: new.md}]\n---\n# Option B",
		"same.md": "# Same",
	});
	const result = compareHistory(before, after);
	expect(result.changes).toHaveLength(1);
	expect(result.changes[0]?.reasons).toEqual([
		"Recorded evidence changed (not verified acceptance)",
		"Recorded owner changed (not authorship)",
		"Recorded status changed (not acceptance)",
		"Decision Markdown changed",
	]);
	expect(compareHistory(before, { ...before, recordedAt: after.recordedAt }).changes).toEqual([]);
});
it("matches only unique explicit IDs across moves, with path-only additions/removals for ordinary renames", () => {
	const before = historyFixture({ "old.md": "---\nid: stable\n---\n# Item", "plain.md": "# Plain", "removed.md": "# Removed" });
	const after = historyFixture({ "added.md": "# Added", "nested/new.md": "---\nid: stable\n---\n# Item", "renamed.md": "# Plain" });
	const result = compareHistory(before, after);
	expect(result.changes.filter((change) => change.kind === "changed").map((change) => change.reasons)).toEqual([
		["Source path changed for the same unique item ID"],
	]);
	expect(result.changes.filter((change) => change.kind === "added")).toHaveLength(2);
	expect(result.changes.filter((change) => change.kind === "removed")).toHaveLength(2);
});
it("selects no duplicate identity winner and discloses unknown frontmatter changes", () => {
	const before = historyFixture({ "a.md": "---\nid: same\ncustom: before\n---\n# A", "b.md": "---\nid: same\n---\n# B" });
	const after = historyFixture({ "a.md": "---\nid: same\ncustom: after\n---\n# A", "c.md": "---\nid: same\n---\n# B" });
	const result = compareHistory(before, after);
	expect(result.newIds.get("same")).toBeUndefined();
	expect(result.issues).toHaveLength(2);
	expect(result.changes.map((change) => change.kind)).toEqual(["changed", "removed", "added"]);
	expect(result.changes[0]?.reasons[0]).toContain("no further interpretation");
});
it("renders old and deleted source as escaped plain text with no executable Markdown assets", () => {
	const before = historyFixture({ "deleted.md": "<script>alert(1)</script>\n![asset](https://example.test/a.png)" });
	const html = historyHtml(before, historyFixture({}));
	expect(html).toContain("1 removed");
	expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
	expect(html).not.toContain("<img");
	expect(html).not.toContain("<script>");
	expect(html).not.toContain('href="/deleted.md"');
});
