import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { declarationFiles } from "#test/declarationFiles.ts";

export const declarations = storyKit({
	clock: "test",
	create: () => Effect.succeed({ declarationFiles }),
	name: "jobs declarations through the TypeScript compiler",
	stages: [],
	verbs: (engine, story) => ({
		compile: () => {
			story.tell("an application typechecks every emitted jobs module");
			return Effect.promise(() => engine.declarationFiles());
		},
	}),
});
