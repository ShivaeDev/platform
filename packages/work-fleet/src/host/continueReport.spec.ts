import { expect } from "@effect/vitest";
import { boardWork, host } from "#test/hostStory.ts";

const SOURCE = "---\nid: research\nkind: task\nfleet: approved\ndelivers: report\n---\n# Research\n";

host.it(
	"manual continuation archives a done report and adopts the continued report turn",
	[boardWork({ "research.md": SOURCE })],
	function* (daemon) {
		const started = yield* daemon.dispatch("research");
		daemon.finishTurn(started, "Original findings.");
		const original = yield* daemon.reconcile("research");
		expect(original.step).toBe("done");
		const continued = yield* daemon.continue("research", "Check the remaining evidence");
		expect(continued.step).toBe("working");
		expect(continued.report).toBeUndefined();
		expect(continued.history?.[0]?.report).toEqual(original.report);
		const attempt = continued.attempts[0];
		expect(attempt?.prompt).toContain("Check the remaining evidence");
		expect(attempt?.prompt).toContain("Leave repository sources unchanged. Commit nothing, push nothing, and open no PR");
		const receipt = attempt?.receipt;
		if (receipt === undefined) {
			throw new Error("Expected a continued report receipt");
		}
		expect(receipt.sessionId).toBe(original.report?.receipt.sessionId);
		expect(receipt.turnId).not.toBe(original.report?.receipt.turnId);
		daemon.finishTurn(continued, "Updated findings.");
		const completed = yield* daemon.reconcile("research");
		expect(completed.step).toBe("done");
		const report = completed.report;
		if (report === undefined) {
			throw new Error("Expected the continued report publication");
		}
		expect(report.receipt).toEqual(receipt);
		expect(report.sourcePath).not.toBe(original.report?.sourcePath);
		expect(daemon.readBoard(report.sourcePath).endsWith("Updated findings.")).toBe(true);
		expect(daemon.providerLaunches()).toHaveLength(1);
	},
);
