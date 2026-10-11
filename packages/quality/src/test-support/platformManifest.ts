import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { loadConfig } from "#config/load.ts";
import { workspacePackages } from "#imports/workspace.ts";
import { scanned } from "./imports.ts";
import { packageRoot, seedTree } from "./tree.ts";

export async function platformManifest() {
	const root = join(packageRoot, "../..");
	const original = await scanned(root);
	const packages = await workspacePackages(original);
	const config = await Effect.runPromise(loadConfig(root, undefined).pipe(Effect.provide(NodeFileSystem.layer)));
	const fences = config.active.find((rule) => rule.id === "imports/fences");
	if (fences === undefined) {
		throw new Error("Platform must keep its import fences");
	}
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
	return { fences, inputs: { ...fixture, files: [...new Set([...original.files, ...fixture.files])] }, packages };
}
