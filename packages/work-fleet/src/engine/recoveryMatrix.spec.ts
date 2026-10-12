import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "@effect/vitest";
import { decisionReasons, sourceDecisionReasons } from "#test/decisionReasons.ts";
import { decisionSites, sourceDecisionSites } from "#test/decisionSites.ts";
import { postgresTests } from "#test/postgres.ts";
import { recoveryCases } from "#test/recoveryCases.ts";
import { recoveryDaemon } from "#test/recoveryDaemon.ts";
import { runRecoveryCase } from "#test/runRecoveryCase.ts";

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
			sourceDecisionReasons("host/new.ts", 'new BadRequest({message: "New integration reason"});').filter((reason) => !reasons.has(reason)),
		).toEqual(["New integration reason"]);
		expect(
			sourceDecisionReasons("host/new.ts", 'const NEW_REASON = "New integration reason"; new BadRequest({message: NEW_REASON});').filter(
				(reason) => !reasons.has(reason),
			),
		).toEqual(["New integration reason"]);
	});
	for (const [file, original] of [
		["host/runtime.ts", "No-change validation is not configured in this Fleet host; inspect the worker session"],
		["host/quota.ts", "Codex rate limits returned an unknown shape"],
		["engine/repository.ts", "Submission intent was not persisted"],
		["engine/failureMessage.ts", "The integration is unavailable; inspect runtime diagnostics"],
		["board/publishReport.ts", "The worker report could not be recorded on Board; retry the same completed attempt."],
		["board/reportPayload.ts", "Saved report publication payload is invalid; retain the completed attempt"],
		["board/reportPayloadFile.ts", "Report publication payload could not be recovered or persisted; retry the same completed attempt"],
		["board/reportFiles.ts", "Report attachments could not be recorded beside the result; retry the same completed attempt"],
	] as const) {
		it(`a new literal in ${file} requires a matrix row`, () => {
			const reasons = new Set(scenarios.flatMap((scenario) => (typeof scenario.reason === "string" ? [scenario.reason] : [])));
			const source = readFileSync(join(root, file), "utf8");
			const mutated = source.replace(original, "New production failure reason");
			expect(mutated).not.toBe(source);
			expect(sourceDecisionSites(file, mutated)).toEqual(sourceDecisionSites(file, source));
			expect(decisionReasons(root, { [file]: mutated }).filter((reason) => !reasons.has(reason))).toEqual(["New production failure reason"]);
		});
	}
	it("a newly referenced Board producer requires a matrix row", () => {
		const file = "board/publishReport.ts";
		const source = readFileSync(join(root, file), "utf8");
		const original = 'new BoardFailure({ message: "The worker report could not be recorded on Board; retry the same completed attempt." })';
		const mutated = `import { newReportFailure } from "#board/newReportFailure.ts";\n${source.replace(original, "newReportFailure()")}`;
		expect(mutated).toContain("() => newReportFailure()");
		const reasons = new Set(scenarios.flatMap((scenario) => (typeof scenario.reason === "string" ? [scenario.reason] : [])));
		expect(
			decisionReasons(root, {
				[file]: mutated,
				"board/newReportFailure.ts":
					'import { BoardFailure } from "#policy.ts"; export function newReportFailure() { return new BoardFailure({ message: "New Board producer failure" }); }',
			}).filter((reason) => !reasons.has(reason)),
		).toEqual(["New Board producer failure"]);
	});
	it("replaced and swallowed report errors do not become decision reasons", () => {
		const file = "board/reportPayload.ts";
		const source = readFileSync(join(root, file), "utf8");
		const mutated = source.replace("Saved report payload contains invalid files", "New translated Board failure");
		expect(decisionReasons(root, { [file]: mutated })).not.toContain("New translated Board failure");
		expect(
			sourceDecisionReasons(
				"host/new.ts",
				'source.pipe(Effect.catch(() => Effect.succeed(new BoardFailure({ message: "Swallowed report failure" }))));',
			),
		).toEqual([]);
	});
	const test = postgresTests("test");
	for (const action of ["retry", "release"] as const) {
		postgresTests("live")(
			`HTTP daemon closes before the ${action} answer and restarts against the same PostgreSQL records`,
			() => recoveryDaemon(action),
			30_000,
		);
		for (const scenario of scenarios) {
			test(`${scenario.name}: ${action} after restart`, () => runRecoveryCase(scenario.name, action));
		}
	}
});
