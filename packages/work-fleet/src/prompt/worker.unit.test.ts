import { describe, expect, it } from "@effect/vitest";
import { PULL_REQUEST_MARKER, reportedPullRequest, reportedQuestion, reportPrompt, withWorkerGuidance, workerPrompt } from "#prompt/worker.ts";

const prompt = workerPrompt({
	branch: "synthetic/sidebar-tree",
	sharedEnvironment: "/workspace/.synthetic/env.sh",
	task: "---\nid: synthetic.task\n---\n# Make the sidebar a tree\n",
	workId: "synthetic.task",
});
describe("workerPrompt", () => {
	it("puts standing answers after the authored task and before evidence", () => {
		const guidance = "Additive APIs are approved.";
		const guided = withWorkerGuidance(prompt, guidance);
		expect(guided).toContain(guidance);
		expect(guided.indexOf("# Make the sidebar a tree")).toBeLessThan(guided.indexOf(guidance));
		expect(guided.indexOf(guidance)).toBeLessThan(guided.indexOf("Evidence rules:"));
	});
	it("replaces standing answers once when reusing a guided prompt", () => {
		const first = withWorkerGuidance(prompt, "Original approval.");
		expect(withWorkerGuidance(first, "Original approval.")).toBe(first);
		const next = withWorkerGuidance(first, "Updated approval.");
		expect(next).not.toContain("Original approval.");
		expect(next.split("Updated approval.")).toHaveLength(2);
		expect(next).toContain("# Make the sidebar a tree");
	});
	it("adapts report prompts once while retaining the authored task", () => {
		const task = "Find compatibility risks in the selected feature.";
		const report = reportPrompt(task);
		expect(report).toContain(task);
		expect(reportPrompt(report)).toBe(report);
	});
});

describe("reportedPullRequest", () => {
	it("reads one final marker line as a GitHub PR URL or an explicit no-change result", () => {
		expect(reportedPullRequest(`Done.\n${PULL_REQUEST_MARKER} https://github.com/example/repository/pull/1\n`)).toEqual({
			kind: "url",
			url: "https://github.com/example/repository/pull/1",
		});
		expect(reportedPullRequest(`Done.\r\n${PULL_REQUEST_MARKER} none\r\n`)).toEqual({ kind: "none" });
	});
	for (const wrap of ["", "`"]) {
		it(`tolerates whitespace and ${wrap === "" ? "plain" : "backtick-wrapped"} values`, () => {
			expect(reportedPullRequest(`Done.\n \tFLEET_PR:  ${wrap}https://github.com/example/repository/pull/1${wrap} \t\n`)).toEqual({
				kind: "url",
				url: "https://github.com/example/repository/pull/1",
			});
			expect(reportedPullRequest(`Done.\n \tFLEET_PR:  ${wrap}none${wrap} \t\n`)).toEqual({ kind: "none" });
		});
	}
	it("returns nothing for a missing or malformed marker", () => {
		expect(reportedPullRequest("PR: https://example.test/pull/1")).toBeUndefined();
		expect(reportedPullRequest(`${PULL_REQUEST_MARKER} soon`)).toBeUndefined();
	});
	for (const value of [
		"https://example.test/pull/1",
		"https://github.com/example/repository/issues/1",
		"https://github.com/example/repository/pull/0",
		"https://github.com/example/repository/pull/1?extra=true",
		"https://github.com/example/repository/pull/1#extra",
		"`none",
		"none`",
		"none\nMore text",
		"none\nFLEET_PR: none",
	]) {
		it(`rejects malformed or ambiguous reports: ${value}`, () => {
			expect(reportedPullRequest(`${PULL_REQUEST_MARKER} ${value}`)).toBeUndefined();
		});
	}
});

describe("reportedQuestion", () => {
	it("requires an explicit maintainer marker and retains the question context", () => {
		expect(reportedQuestion("FLEET_QUESTION: Ask the maintainer for approval.")).toEqual({
			attentionOwner: "orchestrator",
			question: "Ask the maintainer for approval.",
		});
		expect(reportedQuestion("FLEET_MAINTAINER_QUESTION: Approve this API?\n\nChoose A or B.")).toEqual({
			attentionOwner: "maintainer",
			question: "Approve this API?\n\nChoose A or B.",
		});
		expect(reportedQuestion("Example: FLEET_MAINTAINER_QUESTION: text")).toBeUndefined();
		expect(reportedQuestion("FLEET_MAINTAINER_QUESTION: ")).toBeUndefined();
	});
	it("preserves multiline question context and ignores ordinary reports and empty markers", () => {
		expect(reportedQuestion("I need a decision.\nFLEET_QUESTION: Which storage should I use?\n\n- PostgreSQL\n- SQLite")).toEqual({
			attentionOwner: "orchestrator",
			question: "Which storage should I use?\n\n- PostgreSQL\n- SQLite",
		});
		expect(reportedQuestion("Question?\nFLEET_PR: none")).toBeUndefined();
		expect(reportedQuestion("FLEET_QUESTION:  ")).toBeUndefined();
		expect(reportedQuestion("Example: FLEET_QUESTION: text")).toBeUndefined();
	});
});
