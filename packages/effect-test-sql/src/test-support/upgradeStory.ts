import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { layer } from "./migrationUpgrade.ts";
import { configured } from "./postgres.ts";
import { upgradeCommitVerbs } from "./upgradeCommitVerbs.ts";
import { upgradeFailureVerbs } from "./upgradeFailureVerbs.ts";

export interface UpgradeEngine {
	loads: number;
	runs: number;
	statement: string;
}

export const upgrade = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: (): UpgradeEngine => ({ loads: 0, runs: 0, statement: "" }),
	layer,
	name: "migration upgrade",
	runIf: configured,
	stages: ["schema"],
	verbs: (engine) => ({ ...upgradeCommitVerbs(engine), ...upgradeFailureVerbs(engine) }),
});

export function columnDrift(statement: string, problem: string) {
	return upgrade.trait("schema", problem, (engine) => {
		engine.statement = statement;
	});
}
