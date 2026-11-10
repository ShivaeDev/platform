import { compositionFiles } from "#test/compositionFiles.ts";
import { serviceModule } from "#test/effectPolicyFiles.ts";
import type { SeedFile } from "#testing/adapters/tree.ts";

export const PACKAGES = ["alpha", "beta"] as const;

export const packageProgramFiles: readonly SeedFile[] = [
	{ content: "node_modules/\n", path: ".gitignore" },
	{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }', path: "biome.json" },
	{ content: '{"workspaces":["packages/*"]}', path: "package.json" },
	{ content: 'export default { sources: ["packages"] };', path: "quality.config.ts" },
	...PACKAGES.flatMap((name) => [
		{ content: `{"name":"@demo/${name}","type":"module","dependencies":{"effect":"*"}}`, path: `packages/${name}/package.json` },
		serviceModule(`packages/${name}/src/store.ts`, "export function reads(store: Store) { return store.read(); }"),
		compositionFiles(`packages/${name}/src/application.ts`, false),
	]),
];
