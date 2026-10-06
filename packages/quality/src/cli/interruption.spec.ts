import { afterEach, describe, expect, it } from "vitest";
import { interruptedQuality } from "#test/cli.ts";
import { config, removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("interrupted quality checks", () => {
	it("exits 130 without an internal error when a local rule waits for a remote check", async () => {
		const root = seedTree([
			config(
				'{ rules: { biome: "off" }, local: [{ id: "local/remote", description: "Checks a remote service.", configure: async () => ({ _tag: "Ready", check: async () => { console.log("checking remote"); return new Promise(() => {}); } }) }] }',
			),
		]);
		expect(await interruptedQuality(root)).toEqual({ status: 130, stderr: "", stdout: "checking remote\n" });
	}, 15_000);
});
