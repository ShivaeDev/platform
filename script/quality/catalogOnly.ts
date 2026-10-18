import { defineRule, type Finding } from "@shivaedev/quality/rule.ts";
import { manifestFiles } from "./manifestFiles.ts";

const DEPENDENCY_KEYS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;

function dependencyFinding(path: string, key: string, internal: ReadonlySet<string>, name: string, spec: unknown): readonly Finding[] {
	const allowed = internal.has(name) ? spec === "workspace:*" : typeof spec === "string" && spec.startsWith("catalog:");
	if (allowed) {
		return [];
	}
	return [
		{
			file: path,
			message: internal.has(name)
				? `${key} entry "${name}": "${String(spec)}" points at a workspace package. Internal packages must use "workspace:*"; packing pins the workspace package's own version.`
				: `${key} entry "${name}": "${String(spec)}" bypasses the catalog. Use "catalog:" and pin the exact version in pnpm-workspace.yaml.`,
		},
	];
}

export const catalogOnly = defineRule({
	check: async (inputs) => {
		const manifests = await manifestFiles(inputs);
		const internal = new Set(
			manifests.filter(({ path }) => path !== "package.json").flatMap(({ fields }) => (fields?.name === undefined ? [] : [fields.name])),
		);
		return manifests.flatMap(({ fields, path }) =>
			DEPENDENCY_KEYS.flatMap((key) =>
				Object.entries(fields?.[key] ?? {}).flatMap(([name, spec]) => dependencyFinding(path, key, internal, name, spec)),
			),
		);
	},
	description: "Use workspace:* for internal packages and catalog: for external dependencies.",
	id: "manifests/catalog-only",
});
