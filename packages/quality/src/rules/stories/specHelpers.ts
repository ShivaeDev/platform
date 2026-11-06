import { Effect } from "effect";
import { specReaderSources } from "#adapters/specReaderSources.ts";
import { defineRule } from "#rule.ts";
import { pureReader } from "./pureReader.ts";
import { storySources } from "./sources.ts";
import { findingAt, topLevelHelpers } from "./syntax.ts";

const MESSAGE =
	"Declares a setup or action helper in a spec. Move the action into the story kit's verbs or the setup into its traits in test-support/.";

export const specHelpers = defineRule({
	check: (inputs) =>
		Effect.map(storySources(inputs), (stories) =>
			specReaderSources(stories).flatMap(({ source, nativeCall }) =>
				topLevelHelpers(source)
					.filter((node) => !pureReader(node, nativeCall))
					.map((node) => findingAt(source, node, MESSAGE)),
			),
		),
	description: "Specs state expectations and may keep pure matchers and readers; story-kit traits and verbs in test-support own setup and actions.",
	id: "tests/spec-helpers",
});
