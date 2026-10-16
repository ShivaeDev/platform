import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const preset = JSON.parse(readFileSync(new URL("../../biome/preset.json", import.meta.url), "utf8"));

const declarations = JSON.parse(readFileSync(new URL("../../biome/declarations.json", import.meta.url), "utf8"));

it("permits default exports only in conventional config file paths", () => {
	const includes = ["**/*.config.*", "**/.railway/railway.ts", "**/.railway/railway.py", "**/.railway/railway.go"];
	expect(preset.linter.rules.style.noDefaultExport).toBe("error");
	expect(
		preset.overrides.filter(
			(entry: { readonly linter?: { readonly rules?: { readonly style?: { readonly noDefaultExport?: string } } } }) =>
				entry.linter?.rules?.style?.noDefaultExport === "off",
		),
	).toEqual([{ includes, linter: { rules: { style: { noDefaultExport: "off" } } } }]);
	expect(declarations.filter((entry: { readonly rule: string }) => entry.rule === "lint/style/noDefaultExport")).toEqual([
		{ includes, reason: "Tools load their config files through the default export.", rule: "lint/style/noDefaultExport" },
	]);
});
