import { describe, expect, it } from "@effect/vitest";
import { reviewerPrompt } from "#prompt/reviewer.ts";
import { workerPrompt } from "#prompt/worker.ts";

const input = {
	branch: "synthetic/startup",
	sharedEnvironment: "/synthetic/env.sh",
	task: "Inspect the synthetic feature.",
	workId: "synthetic.task",
};
const code = workerPrompt(input);
const report = workerPrompt({ ...input, deliverable: "report" });
const reviewer = reviewerPrompt({
	result: { evidence: [], head: "synthetic-head", kind: "no-change" },
	sharedEnvironment: input.sharedEnvironment,
	task: input.task,
});

describe("cloud startup", () => {
	for (const [role, prompt] of Object.entries({ code, report, reviewer })) {
		it(`gives the ${role} login-shell activation and a single version-mismatch fallback`, () => {
			expect(prompt).toContain("Default login shells");
			expect(prompt).toContain("profile hook");
			expect(prompt).not.toMatch(/every independent shell command|at the start of every|per-command/iu);
			const fallback =
				"If `node -v` does not report the repository's `.node-version`, source /synthetic/env.sh once in that command and say so in the final message.";
			expect(prompt).toContain(fallback);
			expect(prompt.split(input.sharedEnvironment)).toHaveLength(2);
		});
	}
	it("orders fetch, branch creation and dependency setup before the code task", () => {
		const instructions = [
			"Fetch origin/main",
			"create synthetic/startup",
			"run `./script/update`",
			"Implement this approved Board task:",
			input.task,
		];
		const positions = instructions.map((instruction) => code.indexOf(instruction));
		for (const position of positions) {
			expect(position).toBeGreaterThan(-1);
		}
		expect(positions).toEqual([...positions].sort((left, right) => left - right));
		expect(code).toContain("Immediately after fetching origin/main and creating the branch");
		expect(code).toContain("with escalation (require_escalated), since it installs dependencies, before any other command or task work");
	});
	it("requires setup before a report worker executes repository commands", () => {
		expect(report).toContain(
			"Before executing repository commands, run `./script/update` with escalation (require_escalated), since it installs dependencies",
		);
		expect(report.indexOf("run `./script/update`")).toBeLessThan(report.indexOf(input.task));
		expect(report).not.toContain("Fetch origin/main");
		expect(reviewer).not.toContain("./script/update");
	});
});
