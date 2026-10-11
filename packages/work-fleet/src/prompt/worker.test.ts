import { describe, expect, it } from "@effect/vitest";
import { PULL_REQUEST_MARKER, QUESTION_MARKER, reportedPullRequest, reportedQuestion, workerPrompt } from "#prompt/worker.ts";

const prompt = workerPrompt({
	branch: "synthetic/sidebar-tree",
	sharedEnvironment: "/workspace/.synthetic/env.sh",
	task: "---\nid: synthetic.task\n---\n# Make the sidebar a tree\n",
	workId: "synthetic.task",
});
describe("workerPrompt", () => {
	it("puts the Cloud startup block before the task and the evidence rules after it", () => {
		const startup = prompt.indexOf("Cloud startup:");
		const task = prompt.indexOf("# Make the sidebar a tree");
		const evidence = prompt.indexOf("Evidence rules:");
		expect(startup).toBeGreaterThan(-1);
		expect(startup).toBeLessThan(task);
		expect(task).toBeLessThan(evidence);
		expect(prompt).toContain("wait_for_environment");
		expect(prompt).toContain("Source /workspace/.synthetic/env.sh at the start of EVERY independent shell command");
		expect(prompt).toContain("require_escalated) from the FIRST network-dependent command");
		expect(prompt).toContain("create synthetic/sidebar-tree from that exact current revision");
		expect(prompt).toContain("`pnpm ready`");
		expect(prompt).toContain("exactly ONE pull request");
		expect(prompt).toContain("Do not merge it");
		expect(prompt).toContain(`\`${QUESTION_MARKER} <question>\``);
		expect(prompt).toContain("continues this same thread with the recorded answer");
		expect(prompt).toContain(`\`${PULL_REQUEST_MARKER} <url>\``);
	});
	it("requires CI repair on the same branch and current main before reporting", () => {
		expect(prompt).toContain("After every push, watch your PR's CI until all checks finish");
		expect(prompt).toContain("Fix failures on the same branch, push again and repeat");
		expect(prompt).toContain("Before reporting, fetch the latest origin/main and check whether your PR is behind or has conflicts");
		expect(prompt).toContain("merge the latest main into your branch and resolve conflicts");
		expect(prompt).toContain("Run `pnpm ready`, push and watch CI again for the new head");
		expect(prompt).toContain("Report only when all checks are green for the exact head against current main, or when genuinely blocked");
		expect(prompt).toContain("If blocked, explain why and identify the failed or pending checks");
	});
	it("orders PR completion before the final CI result and the PR marker", () => {
		const instructions = [
			"Open exactly ONE pull request",
			"After every push, watch your PR's CI",
			"Before reporting, fetch the latest origin/main",
			"Report only when all checks are green",
			"Final report:",
			"State the CI result for the exact head SHA you report",
			`End with one line \`${PULL_REQUEST_MARKER} <url>\``,
		];
		const positions = instructions.map((instruction) => prompt.indexOf(instruction));
		for (const position of positions) {
			expect(position).toBeGreaterThan(-1);
		}
		expect(positions).toEqual([...positions].sort((left, right) => left - right));
		expect(prompt).toContain("Put the CI result before the final `FLEET_PR:` line");
	});
});
describe("reportedPullRequest", () => {
	it("reads the last marker line as a URL or an explicit no-change result", () => {
		expect(reportedPullRequest(`Done.\n${PULL_REQUEST_MARKER} https://example.test/pull/1\n`)).toEqual({
			kind: "url",
			url: "https://example.test/pull/1",
		});
		expect(reportedPullRequest(`${PULL_REQUEST_MARKER} https://example.test/pull/1\n${PULL_REQUEST_MARKER} \`none\``)).toEqual({ kind: "none" });
	});
	it("returns nothing for a missing or malformed marker", () => {
		expect(reportedPullRequest("PR: https://example.test/pull/1")).toBeUndefined();
		expect(reportedPullRequest(`${PULL_REQUEST_MARKER} soon`)).toBeUndefined();
	});
});

describe("reportedQuestion", () => {
	it("preserves multiline question context and ignores ordinary reports and empty markers", () => {
		expect(reportedQuestion("I need a decision.\nFLEET_QUESTION: Which storage should I use?\n\n- PostgreSQL\n- SQLite")).toBe(
			"Which storage should I use?\n\n- PostgreSQL\n- SQLite",
		);
		expect(reportedQuestion("Question?\nFLEET_PR: none")).toBeUndefined();
		expect(reportedQuestion("FLEET_QUESTION:  ")).toBeUndefined();
		expect(reportedQuestion("Example: FLEET_QUESTION: text")).toBeUndefined();
	});
});
