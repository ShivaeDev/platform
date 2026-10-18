import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "@effect/vitest";
import { DecisionCode } from "#DecisionCode.ts";
import { decisionSites, sourceDecisionSites } from "#test/decisionSites.ts";
import { postgresTests } from "#test/postgres.ts";
import { recoveryCapacityCases } from "#test/recoveryCapacityCases.ts";
import { recoveryCaseGroups, recoveryCases } from "#test/recoveryCases.ts";
import { recoveryDaemon } from "#test/recoveryDaemon.ts";

const engine = dirname(fileURLToPath(import.meta.url));
const root = dirname(engine);
const scenarios = recoveryCases();
const rows = [...scenarios, ...recoveryCapacityCases];
const covered = new Set(scenarios.flatMap((scenario) => scenario.sites));
covered.add('engine/makeState.ts: stage: "needs-human"');
function uncovered(sites: readonly string[]) {
	return sites.filter((site) => !covered.has(site));
}

function uncoveredCodes(codes: readonly string[], cases = rows) {
	const coveredCodes = new Set<string>(cases.map((scenario) => scenario.code));
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
	it("a wrapped decision creation call remains in the inventory", () => {
		expect(sourceDecisionSites("engine/new.ts", 'state\n .decision(stored, "new-code", "New reason", "Inspect");')).toEqual([
			'engine/new.ts: "new-code"',
		]);
	});
	it("every code in the Schema union has a matrix row", () => {
		expect(uncoveredCodes(DecisionCode.literals)).toEqual([]);
	});
	it("a missing code row fails the matrix guard", () => {
		const missing = rows.filter((scenario) => scenario.code !== "reviewed-pr-ready");
		expect(uncoveredCodes(DecisionCode.literals, missing)).toEqual(["reviewed-pr-ready"]);
		for (const code of [
			"session-queue-full",
			"provider-quota-unavailable",
			"session-active-turn",
			"session-active-turn-exhausted",
			"pr-conflicting",
		]) {
			expect(
				uncoveredCodes(
					DecisionCode.literals,
					rows.filter((scenario) => scenario.code !== code),
				),
			).toEqual([code]);
		}
		expect(uncoveredCodes([...DecisionCode.literals, "new-code"])).toEqual(["new-code"]);
	});
	it("every case group runs from its own spec file", () => {
		const groups = Object.keys(recoveryCaseGroups).sort((left, right) => left.localeCompare(right));
		const files = readdirSync(engine).filter((file) => file.endsWith("RecoveryMatrix.spec.ts"));
		expect(files.sort((left, right) => left.localeCompare(right))).toEqual(groups.map((group) => `${group}RecoveryMatrix.spec.ts`));
		for (const group of groups) {
			expect(readFileSync(join(engine, `${group}RecoveryMatrix.spec.ts`), "utf8")).toContain(`recoveryMatrix("${group}");`);
		}
	});
	for (const scenario of recoveryCapacityCases) {
		postgresTests("live")(`${scenario.code}: ${scenario.name}`, scenario.run);
	}
	for (const action of ["retry", "release"] as const) {
		postgresTests("live")(
			`HTTP daemon closes before the ${action} answer and restarts against the same PostgreSQL records`,
			() => recoveryDaemon(action),
			30_000,
		);
	}
});
