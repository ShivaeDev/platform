import { rmSync } from "node:fs";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { seedTree } from "#quality-fixtures/tree.ts";
import { collectInventory } from "#quality-internal/inventory/collect.ts";

export const inventoryKit = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync(() =>
				seedTree([
					{ content: "export const b = 1;", path: "src/b.ts" },
					{ content: "export const a = 1;", path: ".worktrees/copy/src/a.ts" },
					{ content: "export const a = 1;", path: "nested/.worktrees/copy/src/a.ts" },
				]),
			),
			(root) => Effect.sync(() => rmSync(root, { force: true, recursive: true })),
		),
	name: "inventory",
	stages: [],
	verbs: (root, story) => ({
		collect: () => {
			story.tell("collect the repository inventory");
			return collectInventory(root, { exclude: [], extensions: [".ts"], sources: ["."] }).pipe(Effect.provide(NodeFileSystem.layer));
		},
	}),
});
