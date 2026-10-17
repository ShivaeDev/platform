import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { layer } from "./migrationUpgrade.ts";
import { narrated } from "./narrated.ts";
import { configured } from "./postgres.ts";
import { upgradeCommitVerbs } from "./upgradeCommitVerbs.ts";
import { upgradeFailureVerbs } from "./upgradeFailureVerbs.ts";

export interface UpgradeEngine {
	loads: number;
	problem: string;
	runs: number;
	statement: string;
}

const kit = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: (): UpgradeEngine => ({ loads: 0, problem: "", runs: 0, statement: "" }),
	layer,
	name: "migration upgrade",
	stages: ["schema"],
	verbs: (engine, story) => {
		const verbs = { ...upgradeCommitVerbs(engine), ...upgradeFailureVerbs(engine) };
		return {
			driftIsReported: narrated(story.tell, "drift is reported", verbs.driftIsReported),
			invalidUpgradeStatesAreRejected: narrated(story.tell, "invalid upgrade states are rejected", verbs.invalidUpgradeStatesAreRejected),
			populatedMixedCaseLedgerIsUntouched: narrated(
				story.tell,
				"populated mixed case ledger is untouched",
				verbs.populatedMixedCaseLedgerIsUntouched,
			),
			upgradeCommitsOldSchema: narrated(story.tell, "upgrade commits old schema", verbs.upgradeCommitsOldSchema),
			upgradeFailuresKeepOldSchema: narrated(story.tell, "upgrade failures keep old schema", verbs.upgradeFailuresKeepOldSchema),
		};
	},
});

export const upgrade = { ...kit, it: kit.it.skipIf(!configured) };
export function columnDrift(statement: string, problem: string) {
	return upgrade.trait("schema", problem, (engine) => {
		engine.statement = statement;
		engine.problem = problem;
	});
}
