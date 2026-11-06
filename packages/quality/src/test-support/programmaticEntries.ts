import { repositoryHas } from "#test/ruleStory.ts";

export function programmaticEntries() {
	return repositoryHas(
		{ content: '{"name":"workspace","private":true,"workspaces":["apps/*"]}', path: "package.json" },
		{ content: 'packages:\n  - "apps/*"\n', path: "pnpm-workspace.yaml" },
		{
			content: '{"name":"desktop","private":true,"devDependencies":{"esbuild":"*"},"scripts":{"build":"node script/build.ts"}}',
			path: "apps/desktop/package.json",
		},
		{ content: 'import { bundler } from "./adapters/bundler.ts"; bundler();', path: "apps/desktop/script/build.ts" },
		{
			content: `import { build } from "esbuild";
import { resolve } from "node:path";
const MAIN = "src/main.ts";
export function bundler() {
  return build({ entryPoints: [resolve(process.cwd(), MAIN), "src/adapters/preload.ts"] });
}`,
			path: "apps/desktop/script/adapters/bundler.ts",
		},
		{ content: 'import { launch } from "./launch.ts"; export const program = launch;', path: "apps/desktop/src/main.ts" },
		{ content: "export const launch = 1; export const abandonedExport = 2;", path: "apps/desktop/src/launch.ts" },
		{ content: 'export const bridge = "desktop";', path: "apps/desktop/src/adapters/preload.ts" },
		{ content: "export const unused = 1;", path: "apps/desktop/src/abandoned.ts" },
		{ content: 'export const notes = "src/mentioned.ts";', path: "apps/desktop/script/notes.ts" },
		{ content: "export const mentioned = 1;", path: "apps/desktop/src/mentioned.ts" },
		{
			content: 'import { build } from "esbuild"; build({ entryPoints: ["src/unshipped.ts"] });',
			path: "apps/desktop/script/abandoned.ts",
		},
		{ content: "export const unused = 1;", path: "apps/desktop/src/unshipped.ts" },
	);
}
