import { Effect } from "effect";
import { pureReader } from "#adapters/pureReader.ts";
import { specReaderSources } from "#adapters/specReaderSources.ts";
import { defineRule } from "#rule.ts";
import { storySources } from "#rules/stories/sources.ts";
import { findingAt, topLevelHelpers } from "#rules/stories/syntax.ts";

const MESSAGE =
	"Declares a setup or action helper in a spec. Move the action into the story kit's verbs or the setup into its traits in test-support/.";

export const specHelpers = defineRule({
	check: (inputs) =>
		Effect.flatMap(storySources(inputs), (stories) =>
			Effect.map(specReaderSources(stories), (readers) =>
				readers.flatMap(({ source, readCall }) =>
					topLevelHelpers(source)
						.filter((node) => !pureReader(node, readCall))
						.map((node) => findingAt(source, node, MESSAGE)),
				),
			),
		),
	description: "Specs state expectations and may keep pure matchers and readers; story-kit traits and verbs in test-support own setup and actions.",
	id: "tests/spec-helpers",
	needs: "story-program",
});
