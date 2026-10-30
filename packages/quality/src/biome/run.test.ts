import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBiome } from "#biome/run.ts";
import { run } from "#test/run.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("running Biome", () => {
	it("reports a missing repository before process startup", async () => {
		await expect(run(runBiome(join(seedTree([]), "removed"), ["check"]))).rejects.toMatchObject({ reason: { _tag: "NotFound" } });
	});
});
