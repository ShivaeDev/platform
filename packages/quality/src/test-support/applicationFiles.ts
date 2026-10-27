import type { SeedFile } from "./tree.ts";

export function manifest(path: string, fields: object): SeedFile {
	return { content: `${JSON.stringify(fields, null, "\t")}\n`, path };
}

function piece(name: string, module: string): readonly SeedFile[] {
	return [
		manifest(`modules/${name}/package.json`, { exports: { "./*.ts": "./src/*.ts" }, name: `@shivaedev/${name}` }),
		{ content: `export const ${module} = 1;\n`, path: `modules/${name}/src/${module}.ts` },
	];
}

export const HOIST_WORKSPACE: SeedFile = {
	content: 'packages:\n  - modules/*\npublicHoistPattern: ["@shivaedev/*"]\n',
	path: "pnpm-workspace.yaml",
};

export const PLAIN_WORKSPACE: SeedFile = { content: "packages:\n  - modules/*\n", path: "pnpm-workspace.yaml" };

export const entryPointWorkspace: readonly SeedFile[] = [
	manifest("package.json", { name: "workspace", private: true }),
	manifest("modules/platform/package.json", {
		dependencies: { "@shivaedev/sql": "workspace:*" },
		exports: { "./package.json": "./package.json" },
		name: "@shivaedev/platform",
	}),
	manifest("modules/test-story/package.json", {
		dependencies: { "@shivaedev/test": "workspace:*" },
		exports: { "./*.ts": "./src/*.ts" },
		name: "@shivaedev/test-story",
	}),
	...piece("sql", "repository"),
	...piece("test", "story"),
];

export function application(path: string, fields: object): SeedFile {
	return manifest(path, { name: "app", private: true, ...fields });
}

export const platformApp = {
	dependencies: { "@shivaedev/platform": "workspace:*" },
	devDependencies: { "@shivaedev/test-story": "workspace:*" },
};

export const pieceImports: readonly SeedFile[] = [
	{ content: 'import { repository } from "@shivaedev/sql/repository.ts";\nexport const app = repository;\n', path: "modules/app/src/app.ts" },
	{ content: 'import { story } from "@shivaedev/test/story.ts";\nexport const checked = story;\n', path: "modules/app/src/app.test.ts" },
];

export const generatedApplication: readonly SeedFile[] = [
	manifest("package.json", {
		dependencies: { "@shivaedev/platform": "0.34.0" },
		devDependencies: { "@shivaedev/quality": "0.41.1", "@shivaedev/test-story": "0.20.1" },
		name: "app",
		private: true,
		type: "module",
	}),
	manifest("node_modules/@shivaedev/platform/package.json", { dependencies: { "@shivaedev/sql": "0.21.0" }, name: "@shivaedev/platform" }),
	manifest("node_modules/@shivaedev/test-story/package.json", { dependencies: { "@shivaedev/test": "0.9.0" }, name: "@shivaedev/test-story" }),
	{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"], "root": true }\n', path: "biome.json" },
	{ content: "node_modules/\n", path: ".gitignore" },
	{ content: 'import { repository } from "@shivaedev/sql/repository.ts";\n\nexport const app = repository;\n', path: "src/app.ts" },
	{ content: 'import { story } from "@shivaedev/test/story.ts";\n\nexport const checked = story;\n', path: "src/app.test.ts" },
	{ content: 'import { users } from "@shivaedev/admin/users.ts";\n\nexport const listed = users;\n', path: "src/admin.ts" },
	{ content: 'import { story } from "@shivaedev/test/story.ts";\n\nexport const shipped = story;\n', path: "src/shipped.ts" },
];
