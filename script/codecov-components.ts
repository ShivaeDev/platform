import { join } from "node:path";
import process from "node:process";
import { Effect, FileSystem } from "effect";
import { components, withComponents } from "#codecov/components.ts";
import { runMain } from "#lint/adapters/run.ts";
import { collectInventory } from "#lint/inventory.ts";
import { workspacePackages } from "#lint/workspace.ts";

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const inventory = yield* collectInventory(process.cwd());
	yield* fs.writeFileString(join(inventory.root, "codecov.yml"), withComponents(inventory.codecov, components(workspacePackages(inventory))));
});

runMain(program);
