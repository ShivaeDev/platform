import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { compiler } from "./compiler.ts";

export const compilerStory = storyKit({
	create: () => Effect.succeed(compiler),
	name: "contract compiler",
	stages: [],
	verbs: (engine, story) => ({
		declarations: () =>
			Effect.sync(() => {
				story.tell("compile the contract, binding and handlers to declarations");
				return engine.declarations();
			}),
		invalid: (fixtures: readonly string[]) =>
			Effect.sync(() => {
				story.tell(`compile invalid contract uses: ${fixtures.join(", ")}`);
				return engine.invalid(fixtures);
			}),
	}),
});
