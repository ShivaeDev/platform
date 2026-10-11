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
