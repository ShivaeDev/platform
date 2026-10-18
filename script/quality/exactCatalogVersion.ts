import { defineRule } from "@shivaedev/quality/rule.ts";
import { catalog } from "./catalog.ts";

const EXACT_VERSION = /^(?:npm:.+@)?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

export const exactCatalogVersion = defineRule({
	check: async (inputs) =>
		(await catalog(inputs)).entries.flatMap(({ line, name, section, value }) =>
			section === "catalog" && !EXACT_VERSION.test(value)
				? [
						{
							file: "pnpm-workspace.yaml",
							line,
							message: `catalog entry "${name}: ${value}" is not an exact version. Ranges are banned; pin the version and let upgrades be visible diffs.`,
						},
					]
				: [],
		),
	description: "Pin every default and named catalog entry to an exact version.",
	id: "manifests/exact-catalog-version",
});
