import { Effect } from "effect";
import { defineRule } from "@shivaedev/quality/rule.ts";
import { catalog } from "#quality/catalog.ts";

const EXACT_VERSION = /^(?:npm:.+@)?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

function versionFinding({
	line,
	name,
	section,
	value,
}: {
	readonly line: number;
	readonly name: string;
	readonly section: string;
	readonly value: string;
}) {
	return section === "catalog" && !EXACT_VERSION.test(value)
		? [
				{
					file: "pnpm-workspace.yaml",
					line,
					message: `catalog entry "${name}: ${value}" is not an exact version. Ranges are banned; pin the version and let upgrades be visible diffs.`,
				},
			]
		: [];
}

export const exactCatalogVersion = defineRule({
	check: (inputs) => Effect.map(catalog(inputs), ({ entries }) => entries.flatMap(versionFinding)),
	description: "Pin every default and named catalog entry to an exact version.",
	id: "manifests/exact-catalog-version",
});
