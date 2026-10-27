import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/test/it.ts";
import { readReviewerVerdict, reviewerPrompt } from "#prompt/reviewer.ts";

const receipt = { sessionId: "review-session", turnId: "review-turn" };
const verdict = { evidence: ["Inspected the exact diff"], findings: [], head: "exact-head", verdict: "approve" };
function report(value: unknown) {
	return `FLEET_REVIEW: ${JSON.stringify(value)}`;
}

describe("reviewer prompt and verdict", () => {
	it("carries the authored task and exact result into the review request", () => {
		const task = "# Distinct review task\nInspect the changed behavior.";
		const result = { head: "reviewed-head", kind: "change" as const, paths: ["src/scope.ts"], pr: "https://example.test/pull/42" };
		const prompt = reviewerPrompt({ result, sharedEnvironment: "/synthetic/review-env.sh", task });
		expect(prompt).toContain(task);
		expect(prompt).toContain(JSON.stringify(result));
		expect(prompt).toContain("/synthetic/review-env.sh");
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
