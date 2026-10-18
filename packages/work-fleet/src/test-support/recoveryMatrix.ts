import { describe } from "@effect/vitest";
import { postgresTests } from "#test/postgres.ts";
import { type RecoveryCaseGroup, recoveryCaseGroups } from "#test/recoveryCases.ts";
import { runRecoveryCase } from "#test/runRecoveryCase.ts";

export function recoveryMatrix(group: RecoveryCaseGroup) {
	const test = postgresTests("test");
	describe(`${group} decisions recover after restart`, () => {
		for (const action of ["retry", "release"] as const) {
			for (const [row, scenario] of recoveryCaseGroups[group]().entries()) {
				test(`${scenario.code}: ${scenario.name}: ${action} after restart`, () => runRecoveryCase(group, row, action));
			}
		}
	});
}
