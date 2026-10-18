import { join } from "node:path";
import process from "node:process";
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { collectInventory } from "@shivaedev/quality/inventory/collect.ts";
import { components, withComponents } from "#codecov/components.ts";
import { manifestFiles } from "#quality/manifestFiles.ts";

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const root = process.cwd();
	const inventory = yield* collectInventory(root, { exclude: [], extensions: [], sources: ["packages", "examples"] });
	const manifests = yield* Effect.promise(() =>
		manifestFiles({
			files: inventory.files,
			readText: (path) => Effect.runPromise(fs.readFileString(join(root, path))),
		}),
	);
	const packages = manifests.flatMap(({ fields, path }) =>
		path === "package.json" || fields?.name === undefined
			? []
			: [
					{
						name: fields.name,
						root: path.slice(0, -"/package.json".length),
					},
				],
	);
	const codecov = yield* fs.readFileString(join(root, "codecov.yml"));
	yield* fs.writeFileString(join(root, "codecov.yml"), withComponents(codecov, components(packages)));
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeFileSystem.layer)));
