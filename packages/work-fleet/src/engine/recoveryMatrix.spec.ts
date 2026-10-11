import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect } from "@effect/vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { decisionReasons, sourceDecisionReasons } from "#test/decisionReasons.ts";
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

describe("every published Fleet decision has a recovery", () => {
	it("production decision creation sites exactly match the matrix", () => {
		expect([...covered].sort((left, right) => left.localeCompare(right))).toEqual(
			[...new Set(decisionSites(root))].sort((left, right) => left.localeCompare(right)),
		);
	});
	it("a new reason or direct stuck state fails the inventory guard", () => {
		const added = sourceDecisionSites("engine/new.ts", 'state.decision(stored, "New reason", "Inspect");');
		expect(uncovered([...decisionSites(root), ...added])).toEqual(['engine/new.ts: "New reason"']);
		expect(uncovered(sourceDecisionSites("engine/new.ts", 'save(stored, {stage: "needs-human"});'))).toEqual(['engine/new.ts: stage: "needs-human"']);
	});
	it("production integration and persistence failure reasons have matrix rows", () => {
		const reasons = new Set(scenarios.flatMap((scenario) => (typeof scenario.reason === "string" ? [scenario.reason] : [])));
		expect(decisionReasons(root).filter((reason) => !reasons.has(reason))).toEqual([]);
		expect(
			sourceDecisionReasons("host/new.ts", 'new FleetFailure({message: "New integration reason", reason: "invalid"});').filter(
				(reason) => !reasons.has(reason),
			),
		).toEqual(["New integration reason"]);
		expect(
			sourceDecisionReasons(
				"host/new.ts",
				'const NEW_REASON = "New integration reason"; new FleetFailure({message: NEW_REASON, reason: "invalid"});',
			).filter((reason) => !reasons.has(reason)),
		).toEqual(["New integration reason"]);
	});
	it("a new literal in an existing production failure producer requires a matrix row", () => {
		const reasons = new Set(scenarios.flatMap((scenario) => (typeof scenario.reason === "string" ? [scenario.reason] : [])));
		for (const [file, original] of [
			["host/runtime.ts", "No-change validation is not configured in this Fleet host; inspect the worker session"],
			["host/quota.ts", "Codex rate limits returned an unknown shape"],
			["engine/repository.ts", "Submission intent was not persisted"],
		] as const) {
			const source = readFileSync(join(root, file), "utf8");
			const mutated = source.replace(original, "New production failure reason");
			expect(mutated).not.toBe(source);
			expect(sourceDecisionSites(file, mutated)).toEqual(sourceDecisionSites(file, source));
			expect(decisionReasons(root, { [file]: mutated }).filter((reason) => !reasons.has(reason))).toEqual(["New production failure reason"]);
		}
	});
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	for (const action of ["retry", "release"] as const) {
		it.live.skipIf(storageDatabaseUrl === undefined)(
			`HTTP daemon closes before the ${action} answer and restarts against the same PostgreSQL records`,
			() => recoveryDaemon(action),
			30_000,
		);
		for (const scenario of scenarios) {
			test(`${scenario.name}: ${action} after restart`, () => runRecoveryCase(scenario.name, action));
		}
	}
});
