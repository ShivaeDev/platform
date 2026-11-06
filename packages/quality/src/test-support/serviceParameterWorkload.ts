import type { SeedFile } from "#testing/adapters/tree.ts";

export function serviceParameterWorkload(): readonly SeedFile[] {
	const files: SeedFile[] = [
		{ content: '{"name":"@fixture/app","private":true,"workspaces":["packages/*"]}', path: "package.json" },
		{ content: "packages:\n  - packages/*\n", path: "pnpm-workspace.yaml" },
	];
	for (let part = 0; part < 12; part += 1) {
		const directory = `packages/part-${part}`;
		files.push(
			{ content: JSON.stringify({ name: `@fixture/part-${part}`, private: true }), path: `${directory}/package.json` },
			{
				content: `import { Context, Effect } from "effect";
export interface StoreShape { readonly read: () => Effect.Effect<string> }
export class Store extends Context.Service<Store, StoreShape>()("Store") {}`,
				path: `${directory}/src/store.ts`,
			},
		);
		for (let module = 0; module < 20; module += 1) {
			files.push({
				content: [
					'import { Effect, FileSystem, Schema } from "effect";',
					'import { Store, type StoreShape } from "./store.ts";',
					...Array.from(
						{ length: 5 },
						(_, index) =>
							`export const run${index} = (store: StoreShape, fileSystem: FileSystem.FileSystem, codec: Schema.Top) => Effect.succeed(store);`,
					),
				].join("\n"),
				path: `${directory}/src/module-${module}.ts`,
			});
		}
	}
	return files;
}
