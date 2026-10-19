import { expect, it } from "vitest";
import { checkRule } from "#quality/test-support/checkRule.ts";
import { exactCatalogVersion } from "./exactCatalogVersion.ts";

it.each(["^4.0.4", "~4.0.4", "latest", "workspace:*", "4.0", "npm:effect@^4.0.4"])("rejects the non-exact catalog version %s", async (version) => {
	expect(await checkRule(exactCatalogVersion, { "pnpm-workspace.yaml": `catalog:\n  effect: '${version}'\n` })).toEqual([
		{ file: "pnpm-workspace.yaml", line: 2, message: expect.stringContaining("is not an exact version") },
	]);
});

it("accepts quoted pins, prereleases, build metadata and npm aliases", async () => {
	expect(
		await checkRule(exactCatalogVersion, {
			"pnpm-workspace.yaml": [
				"catalog:",
				'  effect: "4.0.4" # exact pin',
				"  prerelease: 4.0.0-rc.1",
				"  build: '1.2.3+build.4'",
				"  alias: npm:other@1.2.3",
			].join("\n"),
		}),
	).toEqual([]);
});

it("checks named catalogs and stops at the next top-level section", async () => {
	expect(await checkRule(exactCatalogVersion, { "pnpm-workspace.yaml": "catalogs:\n  stable:\n    effect: ^4.0.4\n" })).toEqual([
		{ file: "pnpm-workspace.yaml", line: 3, message: expect.stringContaining("is not an exact version") },
	]);
	expect(
		await checkRule(exactCatalogVersion, {
			"pnpm-workspace.yaml": "catalogs:\n  stable:\n    effect: 4.0.4\npackages:\n  - packages/*\noverrides:\n  effect: catalog:\n",
		}),
	).toEqual([]);
});
