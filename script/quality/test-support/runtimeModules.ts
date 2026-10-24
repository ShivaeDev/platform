import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { findingsIn } from "#quality-fixtures/imports.ts";
import { removeSeededTrees, type SeedFile, seedTree } from "#quality-fixtures/tree.ts";
import { importsRuntime } from "#quality-internal/rules/imports/runtime.ts";

export const runtimeModules = storyKit({
	clock: "live",
	*create() {
		yield* Effect.addFinalizer(() => Effect.sync(removeSeededTrees));
		return { root: seedTree([]) };
	},
	name: "module runtime boundaries",
	stages: ["source"],
	verbs: (engine, story) => ({
		check: () =>
			Effect.promise(async () => {
				story.tell("check the module's imports with Quality's runtime policy");
				return (await findingsIn(importsRuntime, undefined, engine.root)).map(({ file, subject }) => ({ file, subject }));
			}),
	}),
});

export function moduleFiles(files: readonly SeedFile[]) {
	return runtimeModules.trait("source", "a repository contains foundation and module sources", (engine) => {
		engine.root = seedTree(files);
	});
}
