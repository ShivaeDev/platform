import type { SeedFile } from "./tree.ts";

export const kitFiles: readonly SeedFile[] = [
	{
		content: '{"name":"@example/orders","type":"module","imports":{"#test/*":"./src/test-support/*"}}',
		path: "package.json",
	},
	{
		content: 'import { storyKit as kit } from "@shivaedev/test-story/server/storyKit.ts"; export const orders = kit({});',
		path: "src/test-support/orders.ts",
	},
	{ content: 'export { orders as app } from "./orders.ts";', path: "src/test-support/index.ts" },
];

export function spec(content: string, path = "src/orders.spec.ts"): SeedFile {
	return { content, path };
}

export function factoryFiles(factory: string): readonly SeedFile[] {
	return [
		...kitFiles,
		{
			content: `import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";\n${factory}`,
			path: "src/test-support/orderKit.ts",
		},
		{
			content: 'import { buildOrderKit } from "./orderKit.ts"; export const orders = buildOrderKit();',
			path: "src/test-support/factoryOrders.ts",
		},
	];
}

export const prerequisiteFiles: readonly SeedFile[] = [
	{ content: '{"workspaces":["modules/*"]}', path: "package.json" },
	{
		content:
			'{"name":"@shivaedev/test-story","dependencies":{"runner":"workspace:*"},"devDependencies":{"gate":"workspace:*"},"optionalDependencies":{"optional":"workspace:*"}}',
		path: "modules/stories/package.json",
	},
	{ content: '{"name":"runner","peerDependencies":{"values":"workspace:*"}}', path: "modules/engine/package.json" },
	{ content: '{"name":"values","devDependencies":{"gate":"workspace:*"}}', path: "modules/types/package.json" },
	{ content: '{"name":"gate","dependencies":{"runner":"workspace:*"}}', path: "modules/quality/package.json" },
	{ content: '{"name":"optional"}', path: "modules/optional/package.json" },
	{ content: '{"name":"app","devDependencies":{"@shivaedev/test-story":"workspace:*"}}', path: "modules/app/package.json" },
	{ content: '{"name":"@shivaedev/effect-test"}', path: "modules/unrelated/package.json" },
];
