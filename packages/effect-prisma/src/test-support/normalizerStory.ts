import { readFileSync } from "node:fs";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { generatedContractFile, removeGeneratedContractFiles, runNormalizeContract } from "#test/normalizeContractCommand.ts";

export const normalizerStory = storyKit({
	*create() {
		yield* Effect.addFinalizer(() => Effect.sync(removeGeneratedContractFiles));
		return { path: "" };
	},
	name: "contract normalizer",
	stages: ["declarations"],
	verbs: (engine, story) => ({
		invoke: (arguments_: readonly string[]) => {
			story.tell(`the normalizer receives ${arguments_.length} arguments`);
			return runNormalizeContract(arguments_);
		},
		normalize: () => {
			story.tell("the CLI normalizes the generated contract");
			return { ...runNormalizeContract([engine.path]), contents: readFileSync(engine.path, "utf8") };
		},
	}),
});

export function generatedDeclarations(source: string) {
	return normalizerStory.trait("declarations", "the generated contract contains timestamp declarations", (engine) => {
		engine.path = generatedContractFile(source);
	});
}
