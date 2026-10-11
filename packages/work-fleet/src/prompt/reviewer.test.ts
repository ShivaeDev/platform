import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { readReviewerVerdict, reviewerPrompt } from "#prompt/reviewer.ts";

const receipt = { sessionId: "review-session", turnId: "review-turn" };
const verdict = { evidence: ["Inspected the exact diff"], findings: [], head: "exact-head", verdict: "approve" };
function report(value: unknown) {
	return `FLEET_REVIEW: ${JSON.stringify(value)}`;
}

describe("reviewer prompt and verdict", () => {
	it("includes the task, criteria and exact PR without escalation instructions", () => {
		const prompt = reviewerPrompt({
			result: { head: "exact-head", kind: "change", paths: ["src/feature.ts"], pr: "https://example.invalid/pr/1" },
			sharedEnvironment: "/synthetic/env.sh",
			task: "# Task\ncriteria: prove the behavior",
		});
		expect(prompt).toContain("criteria: prove the behavior");
		expect(prompt).toContain('"head":"exact-head"');
		expect(prompt).toContain("https://example.invalid/pr/1");
		expect(prompt).toContain("Source /synthetic/env.sh");
		expect(prompt).toContain("Do not edit, commit, push, merge");
		expect(prompt).not.toContain("Request escalation (require_escalated)");
	});
	it.effect("records approval and concrete changes with the exact receipt", function* () {
		expect(yield* readReviewerVerdict(`Review complete.\n${report(verdict)}\n`, receipt)).toMatchObject({
			head: "exact-head",
			receipt,
			verdict: "approved",
		});
		const findings = ["Handle a missing value before dereferencing it"];
		expect(yield* readReviewerVerdict(report({ ...verdict, findings, verdict: "changes" }), receipt)).toMatchObject({
			findings,
			repairPrompt: findings[0],
			verdict: "changes",
		});
	});
	for (const output of [
		"No verdict",
		"FLEET_REVIEW: invalid JSON",
		report({ ...verdict, evidence: [] }),
		report({ ...verdict, evidence: [" "] }),
		report({ ...verdict, verdict: "changes" }),
		report({ ...verdict, findings: ["Unresolved bug"] }),
		`${report(verdict)}\n${report(verdict)}`,
		`${report(verdict)}\nMore text`,
	]) {
		it.effect(`rejects invalid output ${JSON.stringify(output)}`, function* () {
			expect(yield* readReviewerVerdict(output, receipt).pipe(Effect.flip)).toMatchObject({ reason: "invalid" });
		});
	}
});
