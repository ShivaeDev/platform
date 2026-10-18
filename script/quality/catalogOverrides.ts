import { defineRule } from "@shivaedev/quality/rule.ts";
import { catalog } from "./catalog.ts";
import { manifestFiles } from "./manifestFiles.ts";

const IGNORED_OVERRIDE_KEYS = ["overrides", "pnpm", "resolutions"] as const;

export const catalogOverrides = defineRule({
	check: async (inputs) => {
		const manifests = await manifestFiles(inputs);
		const workspace = await catalog(inputs);
		return [
			...manifests.flatMap(({ fields, path }) =>
				IGNORED_OVERRIDE_KEYS.filter((key) => fields?.[key] !== undefined).map((key) => ({
					file: path,
					message: `"${key}" is not read by pnpm, so its pins would silently do nothing. Put overrides in pnpm-workspace.yaml as "catalog:" entries.`,
				})),
			),
			...workspace.entries
				.filter(({ section, value }) => section === "overrides" && !value.startsWith("catalog:"))
				.map(({ line, name, value }) => ({
					file: "pnpm-workspace.yaml",
					line,
					message: `override "${name}: ${value}" names a version outside the catalog. Pin the version in the catalog and override with "catalog:".`,
				})),
		];
	},
	description: "Keep overrides in pnpm-workspace.yaml and resolve them through the catalog.",
	id: "manifests/catalog-overrides",
});
