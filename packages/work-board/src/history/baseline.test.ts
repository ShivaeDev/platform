import { expect, it } from "vitest";
import { baselineJson, OBSERVED } from "#test/historyFixture.ts";
import { readBaseline } from "./baseline.ts";
import { MAX_AGE, MAX_BYTES } from "./limits.ts";

it("accepts one complete observed baseline only within its 30-day lifetime", () => {
	const raw = baselineJson({ "notes/a.md": "Old source" });
	expect(readBaseline(raw, OBSERVED + MAX_AGE - 1).baseline?.documents).toEqual([{ file: "notes/a.md", source: "Old source" }]);
	expect(readBaseline(raw, OBSERVED + MAX_AGE)).toMatchObject({ baseline: undefined, discard: true });
	expect(readBaseline(raw, OBSERVED - 1).reason).toContain("future");
	expect(readBaseline(null, OBSERVED)).toMatchObject({ baseline: undefined, discard: false });
});
it("rejects corrupt, unsupported, unsafe and duplicate-path observations without inventing history", () => {
	const valid = JSON.parse(baselineJson({ "a.md": "# Source" }));
	const invalid = [
		"broken",
		JSON.stringify({ ...valid, version: 2 }),
		JSON.stringify({ ...valid, extra: 1 }),
		JSON.stringify({ ...valid, "recorded_at": "2026-10-05" }),
		JSON.stringify({ ...valid, documents: [...valid.documents, ...valid.documents] }),
		...["/a.md", "../a.md", "a/../b.md", "a\\b.md", "a/\0b.md", "a//b.md", ".hidden.md"].map((file) =>
			JSON.stringify({ ...valid, documents: [{ file, source: "old" }] }),
		),
	];
	for (const raw of invalid) {
		expect(readBaseline(raw, OBSERVED)).toMatchObject({ baseline: undefined, discard: true });
	}
});
it("bounds serialized UTF-8 bytes, including non-ASCII source and JSON overhead", () => {
	const empty = baselineJson({ "a.md": "" });
	const exact = baselineJson({ "a.md": "x".repeat(MAX_BYTES - new TextEncoder().encode(empty).length) });
	expect(new TextEncoder().encode(exact).length).toBe(MAX_BYTES);
	expect(readBaseline(exact, OBSERVED).baseline).toBeDefined();
	expect(readBaseline(`${exact} `, OBSERVED).reason).toContain("2 MiB");
	expect(readBaseline(baselineJson({ "a.md": "界".repeat(MAX_BYTES / 2) }), OBSERVED).reason).toContain("2 MiB");
});
