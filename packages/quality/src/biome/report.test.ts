import { afterEach, describe, expect, it } from "vitest";
import { biomeReport } from "#biome/report.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("Biome reports", () => {
	it("explains an unsupported command using the real process exit and diagnostic", async () => {
		await expect(biomeReport(seedTree([]), ["unknown-command"])).rejects.toThrow(
			"biome unknown-command --reporter=json --max-diagnostics=none . exited 1 without a report:\nError: expected `COMMAND ...`, got `unknown-command`. Pass `--help` for usage information",
		);
	});
});
