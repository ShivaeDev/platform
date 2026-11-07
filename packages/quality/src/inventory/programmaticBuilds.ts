import { Effect } from "effect";
import { reachableBuilds } from "#adapters/reachableBuilds.ts";
import { importGraph } from "#imports/graph.ts";
import { packageLayout } from "#naming/packageLayout.ts";
import { isTestCode } from "#naming/testName.ts";
import type { RuleInputs } from "#rule.ts";

export const programmaticBuilds = Effect.fn("Inventory.programmaticBuilds")(function* (inputs: RuleInputs) {
	const layout = yield* packageLayout(inputs);
	const scripts = new Set([...layout.scripts, ...inputs.sources.filter((file) => isTestCode(file.path)).map((file) => file.path)]);
	return scripts.size === 0
		? { entries: new Set<string>(), externals: new Map<string, ReadonlySet<string>>() }
		: reachableBuilds(inputs, yield* importGraph(inputs), { ...layout, scripts });
});
