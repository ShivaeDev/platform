import { join } from "node:path";
import { workspacePackages } from "#imports/workspace.ts";
import { scanned } from "./imports.ts";
import { packageRoot, seedTree } from "./tree.ts";

export async function platformManifest() {
	const root = join(packageRoot, "../..");
	const original = await scanned(root);
	const packages = await workspacePackages(original);
	const manifests = await Promise.all(
		["package.json", "pnpm-workspace.yaml", ...packages.map((owner) => `${owner.directory}/package.json`)].map(async (path) => {
			const content = await original.readText(path);
			if (content === undefined) {
				throw new Error(`missing manifest at ${path}`);
			}
			return { content, path };
		}),
	);
	const probes = packages.map((owner) => ({
		content: packages.map((target) => `import "../../${target.directory.split("/").at(-1)}/src/manifestProbe.ts";`).join("\n"),
		path: `${owner.directory}/src/manifestProbe.ts`,
	}));
	const fixture = await scanned(seedTree(manifests, probes));
	return { inputs: fixture };
}
