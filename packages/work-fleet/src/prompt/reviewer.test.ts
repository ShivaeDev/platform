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
		expect(prompt).toContain("Do not edit, commit, push, merge");
		expect(prompt).toContain("gh pr diff");
		expect(prompt).toContain("gh api --method GET");
		expect(prompt).toContain("Network writes are prohibited");
		expect(prompt).toContain("always end with a verdict");
		expect(prompt).toContain("Passing required checks at that exact head are the CI evidence");
		expect(prompt).toContain("merge queue that re-runs CI against the latest main before merging");
		expect(prompt).toContain("A branch behind main without conflicts is not a reason to request changes, repeat review or re-run validation");
		expect(prompt).toContain("Workers merge main only when GitHub reports a conflict or the change needs something that landed there");
		expect(prompt).toContain("Include the passing checks and the access limitation in your evidence list");
		expect(prompt).not.toContain("pnpm db:setup");
		expect(prompt).not.toContain("PLATFORM_EFFECT_");
		expect(prompt).not.toContain("script/lib/postgres-test-environment.ts");
		expect(prompt).not.toContain(".github/workflows/ci.yml");
		expect(prompt).not.toContain("end without a verdict");
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
			expect(yield* readReviewerVerdict(output, receipt).pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
		});
	}
});
