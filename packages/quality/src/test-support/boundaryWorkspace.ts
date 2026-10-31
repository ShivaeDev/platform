import { fence } from "#imports/fence.ts";
import { external, folders, modules } from "#imports/fences/selectors.ts";
import type { Fixture } from "./fixtureTree.ts";

export const browserFence = fence("browser-stays-off-disk")
	.because("The browser code runs without Node.")
	.from(folders("packages/ui/src"))
	.mayNotReach(modules("node:fs"))
	.demonstratedBy({
		illegal: ["packages/ui/src/main.ts", external("node:fs")],
		legal: ["packages/ui/src/main.ts", external("effect")],
	});

export const BROWSER_BOUNDARY = `export default ${JSON.stringify([browserFence])};`;

export function boundaryWorkspace(boundary = BROWSER_BOUNDARY, directory = "packages/ui"): Fixture {
	return {
		files: [
			{ content: '{"workspaces":["packages/*"]}', path: "package.json" },
			{ content: '{"name":"@demo/ui"}', path: "packages/ui/package.json" },
			{ content: boundary, path: `${directory}/quality.fences.config.ts` },
			{ content: 'import "./bridge.ts";', path: "packages/ui/src/main.ts" },
			{ content: 'import "node:fs";', path: "packages/ui/src/bridge.ts" },
			{ content: "throw new Error('not a workspace member');", path: "unrelated/quality.fences.config.ts" },
		],
		story: `a workspace whose ui package's main.ts reaches node:fs through bridge.ts, with ${directory}/quality.fences.config.ts exporting ${boundary === BROWSER_BOUNDARY ? "the browser-stays-off-disk fence" : boundary}, beside a throwing boundary outside the workspace`,
	};
}
