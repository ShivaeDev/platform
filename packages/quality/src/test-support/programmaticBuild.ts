import { repositoryHas } from "#test/ruleStory.ts";

export function programmaticBuild(content: string) {
	return repositoryHas(
		{ content: '{"name":"app","private":true,"devDependencies":{"esbuild":"*"},"scripts":{"build":"node script/build.ts"}}', path: "package.json" },
		{ content, path: "script/build.ts" },
		{ content: "export const application = 1;", path: "src/entry.ts" },
		{ content: "export const abandoned = 1;", path: "src/abandoned.ts" },
	);
}

export const BUILD_SHAPES = [
	["an aliased esbuild build with an entry map", 'import { build as bundle } from "esbuild"; bundle({entryPoints: {main: "src/entry.ts"}});'],
	[
		"esbuild buildSync with advanced inputs",
		'import * as bundler from "esbuild"; bundler.buildSync({entryPoints: [{in: "src/entry.ts", out: "src/abandoned.ts"}]});',
	],
	[
		"esbuild context with constant options",
		'import bundler from "esbuild"; const options = {entryPoints: ["src/entry.ts"]} as const; bundler.context(options);',
	],
	["Bun.build", 'Bun.build({entrypoints: ["src/entry.ts"]});'],
	[
		"a helper-relative joined path",
		'import { build } from "esbuild"; import path from "node:path"; build({entryPoints: [path.join(import.meta.dirname, "../src/entry.ts")]});',
	],
	[
		"a CommonJS helper-relative resolved path",
		'import { build } from "esbuild"; import { resolve as absolute } from "node:path"; build({entryPoints: [absolute(__dirname, "../src/entry.ts")]});',
	],
	[
		"an explicit working directory",
		'import { build } from "esbuild"; import { resolve } from "node:path"; build({absWorkingDir: resolve(import.meta.dirname, "../src"), entryPoints: ["entry.ts"]});',
	],
	[
		"an absolute entry computed in the script package",
		'import { build } from "esbuild"; import { resolve } from "node:path"; build({absWorkingDir: resolve(import.meta.dirname, "../src"), entryPoints: [resolve(process.cwd(), "src/entry.ts")]});',
	],
] as const;
