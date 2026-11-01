import { repositoryHas } from "./ruleStory.ts";

export function unusedEntryPoint(abandoned = false) {
	return repositoryHas(
		{ content: '{"name":"workspace","private":true,"workspaces":["packages/*","apps/*"]}', path: "package.json" },
		{ content: 'packages:\n  - "packages/*"\n  - "apps/*"\n', path: "pnpm-workspace.yaml" },
		{
			content: '{"name":"app","private":true,"dependencies":{"@shivaedev/platform":"*"},"scripts":{"start":"node src/main.ts"}}',
			path: "apps/app/package.json",
		},
		{ content: 'import { value } from "@shivaedev/piece"; console.log(value);', path: "apps/app/src/main.ts" },
		{
			content:
				'{"compilerOptions":{"paths":{"@shivaedev/piece":["../../packages/piece/src/value.ts"],"@shivaedev/unused-piece":["../../packages/unused-piece/src/value.ts"]}},"include":["src"]}',
			path: "apps/app/tsconfig.json",
		},
		{
			content:
				'{"name":"@shivaedev/platform","exports":{"./package.json":"./package.json"},"dependencies":{"@shivaedev/piece":"*","@shivaedev/unused-piece":"*"}}',
			path: "packages/platform/package.json",
		},
		...["piece", "unused-piece"].flatMap((name) => [
			{ content: JSON.stringify({ exports: { ".": "./src/value.ts" }, name: `@shivaedev/${name}` }), path: `packages/${name}/package.json` },
			{ content: "export const value = 1;", path: `packages/${name}/src/value.ts` },
		]),
		...(abandoned ? [{ content: 'import { value } from "@shivaedev/unused-piece"; console.log(value);', path: "apps/app/src/abandoned.ts" }] : []),
	);
}
