import { afterEach, describe, expect, it } from "vitest";
import { quality, trees } from "#test/cli.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("baseline migration boundaries", { timeout: 60_000 }, () => {
	it("refuses to overwrite an existing JSON Lines baseline", () => {
		const root = seedTree(trees.clean, [
			{ content: "", path: "quality/baseline.jsonl" },
			{ content: "{}", path: "quality/baseline.json" },
		]);
		expect(quality(root, "baseline", "migrate")).toEqual({
			status: 2,
			stderr: "quality: quality/baseline.jsonl already exists. Migrate into a baseline file that does not exist yet.\n",
			stdout: "",
		});
	});

	it("names a missing legacy baseline and the option for choosing another", () => {
		expect(quality(seedTree(trees.clean), "baseline", "migrate")).toEqual({
			status: 2,
			stderr: "quality: no baseline at quality/baseline.json to migrate. Name it with --from <file>.\n",
			stdout: "",
		});
	});

	it("refuses an invalid legacy baseline without hiding its invalid count", () => {
		const root = seedTree(trees.clean, [{ content: '{"structure/max-lines":{"src/full.ts":{"count":-1}}}', path: "quality/baseline.json" }]);
		const result = quality(root, "baseline", "migrate");
		expect(result.status).toBe(2);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("quality/baseline.json is invalid");
		expect(result.stderr).toContain("structure/max-lines.src/full.ts.count");
	});
});
