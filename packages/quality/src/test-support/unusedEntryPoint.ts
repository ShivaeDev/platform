import { repositoryHas } from "#test/ruleStory.ts";
import type { SeedFile } from "#testing/adapters/tree.ts";

function piece(name: string): readonly SeedFile[] {
	return [
		{ content: JSON.stringify({ exports: { ".": "./src/value.ts" }, name: `@shivaedev/${name}` }), path: `packages/${name}/package.json` },
		{ content: "export const value = 1;", path: `packages/${name}/src/value.ts` },
	];
}

function importOf(name: string, path: string): SeedFile {
	return { content: `import { value } from "@shivaedev/${name}"; console.log(value);`, path };
}

function workspace(names: readonly string[], folders: readonly string[], files: readonly SeedFile[]) {
	return repositoryHas(
		{ content: '{"name":"workspace","private":true,"workspaces":["packages/*","apps/*"]}', path: "package.json" },
		{ content: 'packages:\n  - "packages/*"\n  - "apps/*"\n', path: "pnpm-workspace.yaml" },
		{
			content: JSON.stringify({
				compilerOptions: { paths: Object.fromEntries(names.map((name) => [`@shivaedev/${name}`, [`../../packages/${name}/src/value.ts`]])) },
				include: folders,
			}),
			path: "apps/app/tsconfig.json",
		},
		...names.flatMap(piece),
		...files,
	);
}

function manifest(path: string, fields: object): SeedFile {
	return { content: JSON.stringify(fields), path };
}

const pieces = { "@shivaedev/piece": "*", "@shivaedev/unused-piece": "*" };

function shell(dependencies: object) {
	return manifest("packages/platform/package.json", { dependencies, exports: { "./package.json": "./package.json" }, name: "@shivaedev/platform" });
}

export function unusedShellEntryPoint(abandoned = false) {
	return workspace(
		["piece", "unused-piece"],
		["src"],
		[
			manifest("apps/app/package.json", {
				dependencies: { "@shivaedev/platform": "*" },
				name: "app",
				private: true,
				scripts: { start: "node src/main.ts" },
			}),
			shell(pieces),
			importOf("piece", "apps/app/src/main.ts"),
			...(abandoned ? [importOf("unused-piece", "apps/app/src/abandoned.ts")] : []),
		],
	);
}

export function unusedTestStoryEntryPoint(abandoned = false) {
	return workspace(
		["piece", "unused-piece", "runtime"],
		["src", "scripts"],
		[
			manifest("apps/app/package.json", {
				dependencies: { "@shivaedev/platform": "*" },
				devDependencies: { "@shivaedev/test-story": "*" },
				name: "app",
				private: true,
				scripts: { check: "node scripts/check.ts", start: "node src/main.ts" },
			}),
			shell({ "@shivaedev/runtime": "*" }),
			manifest("packages/test-story/package.json", { dependencies: pieces, exports: { ".": "./src/story.ts" }, name: "@shivaedev/test-story" }),
			{ content: "export const story = 1;", path: "packages/test-story/src/story.ts" },
			importOf("runtime", "apps/app/src/main.ts"),
			importOf("piece", "apps/app/scripts/check.ts"),
			...(abandoned ? [importOf("unused-piece", "apps/app/scripts/abandoned.ts")] : []),
		],
	);
}
