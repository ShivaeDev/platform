import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DecisionCode } from "#DecisionCode.ts";
import { decisionCoverage } from "#engine/decisionCoverage.ts";
import { decisionSites } from "#test/decisionSites.ts";
import { recoveryCapacityCases } from "#test/recoveryCapacityCases.ts";
import { recoveryCases } from "#test/recoveryCases.ts";
import { recoveryStories } from "#test/recoveryStories.ts";

export function recoveryInventory() {
	const root = dirname(dirname(fileURLToPath(import.meta.url)));
	return decisionCoverage(DecisionCode.literals, decisionSites(root), [
		...recoveryCases(),
		...recoveryCapacityCases,
		...recoveryStories,
		{ sites: ['engine/makeState.ts: step: "waiting"'] },
	]);
}
