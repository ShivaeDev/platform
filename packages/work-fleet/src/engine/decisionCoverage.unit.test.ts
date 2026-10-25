import { expect, it } from "vitest";
import { decisionCoverage } from "#engine/decisionCoverage.ts";
import { sourceDecisionSites } from "#test/sourceDecisionSites.ts";

it("a new code or direct stuck state fails the inventory guard", () => {
	const sites = sourceDecisionSites("engine/new.ts", 'state.decision(stored, "new-code", "New reason", "Inspect"); save(stored, {step: "waiting"});');
	expect(decisionCoverage(["new-code"], sites, [])).toEqual({
		codes: ["new-code"],
		obsoleteSites: [],
		sites: ['engine/new.ts: "new-code"', 'engine/new.ts: step: "waiting"'],
	});
});

it("a wrapped decision creation call remains in the inventory", () => {
	expect(sourceDecisionSites("engine/new.ts", 'state\n .decision(stored, "new-code", "New reason", "Inspect");')).toEqual([
		'engine/new.ts: "new-code"',
	]);
});

it("a missing code row fails the matrix guard", () => {
	const codes = [
		"reviewed-pr-ready",
		"session-queue-full",
		"provider-quota-unavailable",
		"session-active-turn",
		"session-active-turn-exhausted",
		"pr-conflicting",
	];
	for (const code of codes) {
		const rows = codes.filter((candidate) => candidate !== code).map((candidate) => ({ code: candidate }));
		expect(decisionCoverage(codes, [], rows).codes).toEqual([code]);
	}
	expect(
		decisionCoverage(
			[...codes, "new-code"],
			[],
			codes.map((code) => ({ code })),
		).codes,
	).toEqual(["new-code"]);
});
