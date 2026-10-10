import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBiome } from "#biome/run.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("running Biome", () => {
	it("preserves ENOENT when the repository disappears before process startup", async () => {
		await expect(runBiome(join(seedTree([]), "removed"), ["check"])).rejects.toMatchObject({ code: "ENOENT" });
	});
});
