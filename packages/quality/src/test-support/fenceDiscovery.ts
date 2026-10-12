import { fence } from "#imports/fences/dsl.ts";
import { external, folders, modules } from "#imports/fences/selectors.ts";
import { seedTree } from "./tree.ts";

export const browserFence = fence("browser-stays-off-disk")
	.because("The browser code runs without Node.")
	.from(folders("packages/ui/src"))
	.mayNotReach(modules("node:fs"))
	.demonstratedBy({
		illegal: ["packages/ui/src/main.ts", external("node:fs")],
		legal: ["packages/ui/src/main.ts", external("effect")],
	});

export function fenceDiscovery(boundary = `export default ${JSON.stringify([browserFence])};`, directory = "packages/ui") {
	return seedTree([
		{ content: '{"workspaces":["packages/*"]}', path: "package.json" },
		{ content: '{"name":"@demo/ui"}', path: "packages/ui/package.json" },
		{ content: boundary, path: `${directory}/quality.fences.config.ts` },
		{ content: 'import "./bridge.ts";', path: "packages/ui/src/main.ts" },
		{ content: 'import "node:fs";', path: "packages/ui/src/bridge.ts" },
		{ content: "throw new Error('not a workspace member');", path: "unrelated/quality.fences.config.ts" },
	]);
}

import { writeFileSync } from "node:fs";
import { join } from "node:path";

export function replaceBoundary(root: string, content: string): void {
	writeFileSync(join(root, "packages/ui/quality.fences.config.ts"), content);
}
