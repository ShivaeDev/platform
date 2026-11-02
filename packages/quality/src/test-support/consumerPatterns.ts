import type { SeedFile } from "./tree.ts";

export const consumerPatterns: readonly SeedFile[] = [
	{ content: '<script src="/src/client/entry.tsx" type="module"></script>\n', path: "index.html" },
	{ content: '{ "include": ["src"] }', path: "tsconfig.json" },
	{ content: '{ "name": "vite", "license": "MIT", "bin": { "vite": "bin/vite.js" } }', path: "node_modules/vite/package.json" },
	{
		content: 'declare module "effect";\ndeclare module "@tanstack/react-router";\ndeclare module "@tanstack/react-table";',
		path: "src/vendor.d.ts",
	},
	{
		content:
			'{"name":"consumer-app","private":true,"type":"module","imports":{"#client/*":"./src/client/*"},"scripts":{"dev":"vite"},"dependencies":{"@tanstack/react-router":"1.0.0","@tanstack/react-table":"8.0.0","effect":"4.0.0"},"devDependencies":{"vite":"7.0.0"}}',
		path: "package.json",
	},
	{
		content:
			'import { Effect } from "effect";\nimport { columns } from "#client/adapters/columns.ts";\nimport { route } from "#client/adapters/route.ts";\n\nEffect.runSync(Effect.succeed({ columns: columns(), route }));',
		path: "src/client/entry.tsx",
	},
	{
		content:
			'import { notFound, redirect } from "@tanstack/react-router";\n\nexport function goHome() { throw redirect({ to: "/" }); }\nexport function missing() { throw notFound(); }',
		path: "src/client/adapters/navigation.ts",
	},
	{
		content:
			'import { createRoute } from "@tanstack/react-router";\nimport { goHome, missing } from "#client/adapters/navigation.ts";\nexport const route = createRoute({ beforeLoad: () => { goHome(); }, loader: () => { missing(); } });',
		path: "src/client/adapters/route.ts",
	},
	{
		content:
			'import { createColumnHelper } from "@tanstack/react-table";\n\ninterface Feature { readonly title: string; }\nexport function columns() { return createColumnHelper<Feature>(); }',
		path: "src/client/adapters/columns.ts",
	},
];

export const outsideConsumerPatterns: readonly SeedFile[] = consumerPatterns.map(({ content, path }) => ({
	content: content.replaceAll("entry.tsx", "work.tsx").replaceAll("adapters/", "").replace("<Feature>", ""),
	path: path.replace("entry.tsx", "work.tsx").replace("adapters/", ""),
}));
