import { expect, it } from "vitest";
import { checkRule } from "#quality/test-support/checkRule.ts";
import { workspaceSection } from "./workspaceSection.ts";

it.each(["catalog", "catalogs", "overrides"])("rejects inline %s sections, including quoted headings", async (key) => {
	expect(await checkRule(workspaceSection, { "pnpm-workspace.yaml": `'${key}': {}\n` })).toEqual([
		{ file: "pnpm-workspace.yaml", line: 1, message: expect.stringContaining("holds an inline value") },
	]);
	expect(await checkRule(workspaceSection, { "pnpm-workspace.yaml": `${key}: # centralized pins\n  effect: 4.0.4\n` })).toEqual([]);
});

it("refuses a missing workspace catalog", async () => {
	await expect(checkRule(workspaceSection, {})).rejects.toThrow("required input is missing: pnpm-workspace.yaml");
});
