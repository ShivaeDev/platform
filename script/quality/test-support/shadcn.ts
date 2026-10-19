import { rmSync } from "node:fs";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { loadConfig } from "@shivaedev/quality/config/load.ts";
import { runRules } from "@shivaedev/quality/engine/runRules.ts";
import type { Violation } from "@shivaedev/quality/engine/violation.ts";
import { collectInventory, type Inventory } from "@shivaedev/quality/inventory/collect.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type SeedFile, seedTree } from "#quality-fixtures/tree.ts";

interface Repository {
	inventory: Inventory | undefined;
	root: string;
	violations: readonly Violation[];
}

export const shadcn = storyKit({
	clock: "live",
	create: () =>
		Effect.acquireRelease(
			Effect.sync((): Repository => ({ inventory: undefined, root: seedTree([]), violations: [] })),
			({ root }) => Effect.sync(() => rmSync(root, { force: true, recursive: true })),
		),
	layer: NodeFileSystem.layer,
	name: "shadcn source ownership",
	stages: ["configured"],
	verbs: (engine) => ({
		checkStyle: Effect.fn("ShadcnStory.checkStyle")(function* () {
			const config = yield* loadConfig(engine.root, undefined);
			const inventory = yield* collectInventory(engine.root, config);
			engine.inventory = inventory;
			engine.violations = yield* runRules(
				config.active.filter((rule) => rule.id === "structure/max-lines" || rule.id === "comments/no-todo"),
				{
					...inventory,
					readText: () => Promise.resolve(undefined),
					root: engine.root,
				},
			);
		}),
		inventory: () => engine.inventory,
		violations: () => engine.violations,
	}),
});

export function repository(files: readonly SeedFile[]) {
	return shadcn.trait("configured", "an app names its shadcn UI folder", (engine) =>
		Effect.sync(() => {
			rmSync(engine.root, { force: true, recursive: true });
			engine.root = seedTree(files);
		}),
	);
}
