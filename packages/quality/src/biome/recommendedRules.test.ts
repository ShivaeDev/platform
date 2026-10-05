import { describe, expect, it } from "vitest";
import { recommendedRules } from "#biome/recommendedRules.ts";

describe("recommendedRules", () => {
	it("lists the rules the installed Biome enables under its recommended preset, and no others", async () => {
		const rules = await recommendedRules();
		expect(rules).toContain("suspicious/noDebugger");
		expect(rules).not.toContain("style/useBlockStatements");
		expect(rules.join("\n")).toMatch(/^(?:[a-z0-9]+\/[a-zA-Z]+\n?)+$/u);
	});
});
