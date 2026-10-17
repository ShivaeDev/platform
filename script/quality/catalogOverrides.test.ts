import { expect, it } from "vitest";
import { checkRule } from "#quality/test-support/checkRule.ts";
import { catalogOverrides } from "./catalogOverrides.ts";

it.each(["overrides", "pnpm", "resolutions"])("rejects the ignored manifest field %s", async (key) => {
	const texts = { "package.json": "{}", "pnpm-workspace.yaml": "catalog:\n  effect: 4.0.4\n" };
	expect(await checkRule(catalogOverrides, { ...texts, "packages/a/package.json": JSON.stringify({ [key]: {} }) })).toEqual([
		{ file: "packages/a/package.json", message: expect.stringContaining(`"${key}" is not read by pnpm`) },
	]);
	expect(await checkRule(catalogOverrides, texts)).toEqual([]);
});

it("requires workspace overrides to reference the catalog", async () => {
	const texts = { "package.json": "{}" };
	expect(await checkRule(catalogOverrides, { ...texts, "pnpm-workspace.yaml": "overrides:\n  effect: 4.0.4\n" })).toEqual([
		{ file: "pnpm-workspace.yaml", line: 2, message: expect.stringContaining("outside the catalog") },
	]);
	expect(
		await checkRule(catalogOverrides, { ...texts, "pnpm-workspace.yaml": "overrides:\n  effect: catalog:\n  other: 'catalog:stable'\n" }),
	).toEqual([]);
});
