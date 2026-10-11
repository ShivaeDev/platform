import { expect, it } from "@effect/vitest";
import { applyReportPatch } from "#host/applyReportPatch.ts";

it("replays multiple hunks against their original positions", () => {
	expect(
		applyReportPatch("one\ntwo\nthree\nfour\n", "--- old\n+++ new\n@@ -1,2 +1,3 @@\n one\n-two\n+second\n+extra\n@@ -4 +5 @@\n-four\n+last\n"),
	).toBe("one\nsecond\nextra\nthree\nlast\n");
});
it("preserves UTF-8, CRLF and missing final newlines", () => {
	expect(applyReportPatch("界\r\nold", "@@ -1,2 +1,2 @@\n 界\r\n-old\n\\ No newline at end of file\n+new\n\\ No newline at end of file\n")).toBe(
		"界\r\nnew",
	);
});
it("applies empty-file insertions and deletions", () => {
	expect(applyReportPatch("unchanged", "")).toBe("unchanged");
	expect(applyReportPatch("", "@@ -0,0 +1 @@\n+first\n")).toBe("first\n");
	expect(applyReportPatch("last\n", "@@ -1 +0,0 @@\n-last\n")).toBe("");
});
for (const diff of [
	"garbage",
	"@@ -1 +1 @@\n-wrong\n+new\n",
	"@@ -1,2 +1 @@\n-old\n+new\n",
	"@@ -9 +9 @@\n-old\n+new\n",
	"@@ -1 +3 @@\n-old\n+new\n",
	"@@ -1 +1 @@\n-old\n+new\nnew mode 120000\n",
]) {
	it(`rejects a mismatched or malformed patch: ${diff.split("\n")[0]}`, () => {
		expect(() => applyReportPatch("old\n", diff)).toThrow();
	});
}
