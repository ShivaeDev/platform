import type { Fixture } from "./fixtureTree.ts";

interface ManifestTraits {
	readonly declaration?: string;
	readonly workspace?: "npm" | "pnpm";
}

export function manifestTree({ declaration, workspace = "pnpm" }: ManifestTraits = {}): Fixture {
	return {
		files: [
			{ content: JSON.stringify({ name: "external-app", ...(workspace === "npm" ? { workspaces: ["modules/*"] } : {}) }), path: "package.json" },
			...(workspace === "npm" ? [] : [{ content: "packages:\n  - modules/*\n", path: "pnpm-workspace.yaml" }]),
			{
				content: JSON.stringify({
					imports: { "#kit": "plain-kit" },
					name: "@acme/app",
					...(declaration === undefined ? {} : { [declaration]: { "plain-kit": "workspace:*" } }),
				}),
				path: "modules/app/package.json",
			},
			{ content: JSON.stringify({ exports: { ".": "./src/index.ts", "./*": "./src/*" }, name: "plain-kit" }), path: "modules/kit/package.json" },
			{ content: "export const kit = 1;", path: "modules/kit/src/index.ts" },
		],
		story: `a ${workspace} workspace whose @acme/app member ${declaration === undefined ? "declares no dependency on" : `declares in ${declaration}`} the plain-kit member`,
	};
}
