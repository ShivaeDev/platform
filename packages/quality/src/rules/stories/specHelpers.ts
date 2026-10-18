import { defineRule } from "#rule.ts";
import { isSpec, syntaxFindings, topLevelHelpers } from "./syntax.ts";

const MESSAGE = "Declares a top-level helper in a spec. Move the action into the story kit's verbs or the setup into its traits in test-support/.";

export const specHelpers = defineRule({
	check: ({ sources }) => sources.filter((file) => isSpec(file.path)).flatMap((file) => syntaxFindings(file, topLevelHelpers, MESSAGE)),
	description: "Specs state expectations; story-kit traits and verbs in test-support own helpers.",
	id: "tests/spec-helpers",
});
