import { Effect } from "effect";
import { defineRule } from "#rule.ts";
import { storySources } from "./sources.ts";
import { syntaxFindings, topLevelHelpers } from "./syntax.ts";

const MESSAGE = "Declares a top-level helper in a spec. Move the action into the story kit's verbs or the setup into its traits in test-support/.";

export const specHelpers = defineRule({
	check: (inputs) => Effect.map(storySources(inputs), (stories) => stories.flatMap((file) => syntaxFindings(file, topLevelHelpers, MESSAGE))),
	description: "Specs state expectations; story-kit traits and verbs in test-support own helpers.",
	id: "tests/spec-helpers",
});
