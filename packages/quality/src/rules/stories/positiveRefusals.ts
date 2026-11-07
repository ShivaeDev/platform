import { Effect } from "effect";
import { positiveRefusalFindings } from "#adapters/positiveRefusalFindings.ts";
import { importGraph } from "#imports/graph.ts";
import { defineRule } from "#rule.ts";
import { storyOrigins } from "#rules/stories/origins.ts";
import { storySources } from "#rules/stories/sources.ts";

export const positiveRefusals = defineRule({
	check: Effect.fn("Stories.check")(function* (inputs) {
		const files = yield* storySources(inputs);
		const graph = yield* importGraph(inputs);
		const origins = storyOrigins(inputs, graph);
		return files.flatMap((file) => positiveRefusalFindings(file, origins));
	}),
	description: "Negative outcome comparisons in a story need a positive assertion of the expected refusal on the same outcome.",
	id: "tests/positive-refusals",
});
