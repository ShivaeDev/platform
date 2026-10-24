import { expect } from "@effect/vitest";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { WAIT_EXIT } from "#host/wait.ts";
import { REPORT_SOURCE } from "#test/hostReportTraits.ts";
import { boardWork, host } from "#test/hostStory.ts";

const OUTPUT = "  # Findings\n\nWhole report, including whitespace.\n";

host.it("records the whole result and finishes without PR integrations", [boardWork({ "research.md": REPORT_SOURCE })], function* (daemon) {
	const started = yield* daemon.approve("research");
	const observation = daemon.providerObservations()[0];
	expect(observation?.output).toContain("Leave repository sources unchanged. Commit nothing, push nothing, and open no PR");
	daemon.finishTurn(started.value, OUTPUT);
	const value = yield* daemon.reconcile("research");
	expect(value).toMatchObject({ step: "done" });
	expect(value.result).toBeUndefined();
	expect(value.review).toBeUndefined();
	expect(value.checks).toBeUndefined();
	expect(daemon.providerLaunches()).toEqual([started.value.attempts[0]?.operationId]);
	const report = value.report;
	if (report === undefined) {
		throw new Error("Completed report needs a publication receipt");
	}
	expect(report.receipt).toEqual(observation?.receipt);
	const content = daemon.readBoard(report.sourcePath);
	const parsed = metadataParse(content);
	expect(parsed.diagnostics).toEqual([]);
	expect(parsed.fields.kind).toBe("report");
	expect(parsed.fields.relationships).toEqual([{ kind: "informs", target: "research" }]);
	expect(content.endsWith(OUTPUT)).toBe(true);
	expect(content).toContain(JSON.stringify({ ...observation?.receipt, workRevision: value.boardRevision }));
	expect(daemon.boardFiles("responses")).toHaveLength(1);
	expect(daemon.readBoard("research.md")).toBe(
		REPORT_SOURCE.replace("delivers: report\n", 'delivers: report\nstatus: done\nnext_action: "Done; report recorded."\n'),
	);
	expect((yield* daemon.wait("research")).code).toBe(WAIT_EXIT.completed);
	const status = yield* daemon.renderedStatus();
	expect(status).toContain("Done (1)");
	expect(status).toContain("Active (0)");
});

host.it("empty output needs a human and creates no result", [boardWork({ "research.md": REPORT_SOURCE })], function* (daemon) {
	const started = yield* daemon.approve("research");
	daemon.finishTurn(started.value, " \n\t");
	const value = yield* daemon.reconcile("research");
	expect(value.step).toBe("waiting");
	expect(value.decision?.reason).toBe("Report worker returned empty output");
	expect(value.report).toBeUndefined();
	expect(value.result).toBeUndefined();
	expect(value.review).toBeUndefined();
	expect(value.checks).toBeUndefined();
	expect(daemon.providerLaunches()).toHaveLength(1);
	expect(daemon.boardFiles("responses").some((file) => file.startsWith("fleet-report."))).toBe(false);
	expect((yield* daemon.wait("research")).code).toBe(WAIT_EXIT.waitingDecision);
	const status = yield* daemon.renderedStatus();
	expect(status).toContain("Waiting on orchestrator (1)");
	expect(status).toContain("Active (0)");
	const decision = value.decision?.published;
	if (decision === undefined) {
		throw new Error("An empty report needs a Board decision");
	}
	daemon.answerReport(decision, "retry");
	expect((yield* daemon.reconcile("research")).step).toBe("queued");
	yield* daemon.approve("research");
	expect(daemon.providerLaunches()).toHaveLength(2);
});
