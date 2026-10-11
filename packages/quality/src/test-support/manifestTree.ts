import { linkWorkspace } from "./imports.ts";
import { type SeedFile, seedTree } from "./tree.ts";

interface ManifestTraits {
	readonly declaration?: string;
	readonly linked?: boolean;
	readonly workspace?: "npm" | "pnpm";
}

export function manifestTree(files: readonly SeedFile[], traits: ManifestTraits = {}): string {
	const workspace = traits.workspace === "npm" ? { workspaces: ["modules/*"] } : {};
	const root = seedTree([
		{ content: JSON.stringify({ name: "external-app", ...workspace }), path: "package.json" },
		...(traits.workspace === "npm" ? [] : [{ content: "packages:\n  - modules/*\n", path: "pnpm-workspace.yaml" }]),
		{
			content: JSON.stringify({
				imports: { "#kit": "plain-kit" },
				name: "@acme/app",
				...(traits.declaration === undefined ? {} : { [traits.declaration]: { "plain-kit": "workspace:*" } }),
			}),
			path: "modules/app/package.json",
		},
		{ content: JSON.stringify({ exports: { ".": "./src/index.ts", "./*": "./src/*" }, name: "plain-kit" }), path: "modules/kit/package.json" },
		{ content: "export const kit = 1;", path: "modules/kit/src/index.ts" },
		...files,
	]);
	if (traits.linked) {
		linkWorkspace(root, "plain-kit", "modules/kit");
	}
	return root;
}
