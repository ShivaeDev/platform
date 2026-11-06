import { Effect } from "effect";
import { reachableBuildEntries } from "#adapters/reachableBuildEntries.ts";
import { importGraph } from "#imports/graph.ts";
import { packageLayout } from "#naming/packageLayout.ts";
import type { RuleInputs } from "#rule.ts";

export const programmaticEntries = Effect.fn("Inventory.programmaticEntries")(function* (inputs: RuleInputs) {
	const layout = yield* packageLayout(inputs);
	return layout.scripts.size === 0 ? new Set<string>() : reachableBuildEntries(inputs, yield* importGraph(inputs), layout);
});
