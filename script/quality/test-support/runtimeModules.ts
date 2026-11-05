import { Effect } from "effect";
import { importsRuntime } from "@shivaedev/quality/rules/imports/runtime.ts";
import { findingsIn } from "@shivaedev/quality/testing/adapters/imports.ts";
import { removeSeededTrees, type SeedFile, seedTree } from "@shivaedev/quality/testing/adapters/tree.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

export const runtimeModules = storyKit({
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
