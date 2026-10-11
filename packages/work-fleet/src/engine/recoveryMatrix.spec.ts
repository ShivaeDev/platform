import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect } from "@effect/vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { DecisionCode } from "#DecisionCode.ts";
import { decisionSites, sourceDecisionSites } from "#test/decisionSites.ts";
import { recoveryCases } from "#test/recoveryCases.ts";
import { recoveryDaemon } from "#test/recoveryDaemon.ts";
import { runRecoveryCase } from "#test/runRecoveryCase.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scenarios = recoveryCases();
const covered = new Set(scenarios.flatMap((scenario) => scenario.sites));
covered.add('engine/makeState.ts: stage: "needs-human"');
function uncovered(sites: readonly string[]) {
	return sites.filter((site) => !covered.has(site));
}

function uncoveredCodes(codes: readonly string[], rows = scenarios) {
	const coveredCodes = new Set<string>(rows.map((scenario) => scenario.code));
	return codes.filter((code) => !coveredCodes.has(code));
}

describe("every published Fleet decision has a recovery", () => {
	it("production decision creation sites exactly match the matrix", () => {
		expect([...covered].sort((left, right) => left.localeCompare(right))).toEqual(
			[...new Set(decisionSites(root))].sort((left, right) => left.localeCompare(right)),
		);
	});
	it("a new code or direct stuck state fails the inventory guard", () => {
		const added = sourceDecisionSites("engine/new.ts", 'state.decision(stored, "new-code", "New reason", "Inspect");');
		expect(uncovered([...decisionSites(root), ...added])).toEqual(['engine/new.ts: "new-code"']);
		expect(uncovered(sourceDecisionSites("engine/new.ts", 'save(stored, {stage: "needs-human"});'))).toEqual(['engine/new.ts: stage: "needs-human"']);
	});
	it("every code in the Schema union has a matrix row", () => {
		expect(uncoveredCodes(DecisionCode.literals)).toEqual([]);
	});
	it("a missing code row fails the matrix guard", () => {
		const rows = scenarios.filter((scenario) => scenario.code !== "reviewed-pr-ready");
		expect(uncoveredCodes(DecisionCode.literals, rows)).toEqual(["reviewed-pr-ready"]);
		expect(uncoveredCodes([...DecisionCode.literals, "new-code"])).toEqual(["new-code"]);
	});
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	for (const action of ["retry", "release"] as const) {
		it.live.skipIf(storageDatabaseUrl === undefined)(
			`HTTP daemon closes before the ${action} answer and restarts against the same PostgreSQL records`,
			() => recoveryDaemon(action),
			30_000,
		);
		for (const code of DecisionCode.literals) {
			for (const [row, scenario] of scenarios.filter((candidate) => candidate.code === code).entries()) {
				test(`${code}: ${scenario.name}: ${action} after restart`, () => runRecoveryCase(code, row, action));
			}
		}
	}
});
