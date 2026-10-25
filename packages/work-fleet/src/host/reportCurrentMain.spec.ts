import { expect } from "@effect/vitest";
import { movingMain } from "#test/hostReadPass.ts";
import { REPORT_SOURCE } from "#test/hostReportTraits.ts";
import { boardWork, host, localOnlyBoard } from "#test/hostStory.ts";
import { reportHistoryTrait } from "#test/reportHistoryTrait.ts";
import { cloudWorker } from "#test/workerBrief.ts";

const reports = [boardWork({ "research.md": REPORT_SOURCE }, cloudWorker), localOnlyBoard, movingMain, reportHistoryTrait];

host.it("a report worker's brief follows current main at dispatch", reports, function* (daemon) {
	const { descendant } = daemon.researchRevisions();
	yield* daemon.admit();
	daemon.moveMain({ observedAt: 3, revision: descendant });
	const launched = (yield* daemon.approve("research")).value;
	expect(launched.preparation.baseRevision).toBe(descendant);
	const prompt = daemon.providerStarts()[0]?.prompt;
	expect(prompt).toContain("Fetch origin/main, check out that revision detached");
	expect(prompt).toContain(`Expected research base: ${descendant}`);
	expect(prompt).toContain("FLEET_HEAD: <full 40-character checked revision>");
});

host.it("delivers a report researched on its dispatched base and persists its revision", reports, function* (daemon) {
	const { base } = daemon.researchRevisions();
	const launched = (yield* daemon.approve("research")).value;
	daemon.finishTurn(launched, `Current findings.\nFLEET_HEAD: ${base}`);
	const completed = yield* daemon.reconcile("research");
	expect(completed.step).toBe("done");
	expect(completed.attempts[0]?.reportRevision).toBe(base);
	expect(completed.report).toBeDefined();
	yield* daemon.stop();
	yield* daemon.start();
	expect((yield* daemon.get("research")).attempts[0]?.reportRevision).toBe(base);
});

for (const kind of ["older", "divergent"] as const) {
	host.it(`refuses an ${kind} report with a decision and retains the reported revision`, reports, function* (daemon) {
		const history = daemon.researchRevisions();
		const launched = (yield* daemon.approve("research")).value;
		daemon.finishTurn(launched, `Old findings.\nFLEET_HEAD: ${history[kind]}`);
		const refused = yield* daemon.reconcile("research");
		expect(refused.step).toBe("waiting");
		expect(refused.decision?.code).toBe("report-revision");
		expect(refused.decision?.reason).toContain(history.base);
		expect(refused.attempts[0]?.reportRevision).toBe(history[kind]);
		expect(refused.report).toBeUndefined();
		expect(daemon.boardFiles("responses").some((file) => file.startsWith("fleet-report."))).toBe(false);
		expect(refused.decisionPublished).toBe(true);
		yield* daemon.stop();
		yield* daemon.start();
		expect((yield* daemon.get("research")).attempts[0]?.reportRevision).toBe(history[kind]);
		const published = refused.decision?.published;
		if (published === undefined) {
			throw new Error("Refusing stale research needs a Board decision");
		}
		daemon.answerReport(published, "release");
		expect((yield* daemon.reconcile("research")).step).toBe("released");
		const renewed = (yield* daemon.approve("research")).value;
		expect(renewed.history?.[0]?.attempts[0]?.reportRevision).toBe(history[kind]);
	});
}

host.it("delivers a report researched on a descendant of its dispatched base", reports, function* (daemon) {
	const { descendant } = daemon.researchRevisions();
	const launched = (yield* daemon.approve("research")).value;
	daemon.finishTurn(launched, `Later findings.\nFLEET_HEAD: ${descendant}`);
	const completed = yield* daemon.reconcile("research");
	expect(completed.step).toBe("done");
	expect(completed.attempts[0]?.reportRevision).toBe(descendant);
	expect(completed.report).toBeDefined();
});

for (const ending of ["", "\nFLEET_HEAD: invalid", `\nFLEET_HEAD: ${"a".repeat(40)}\nFLEET_HEAD: ${"a".repeat(40)}`]) {
	host.it(`refuses a report without one checked revision: ${ending}`, reports, function* (daemon) {
		const launched = (yield* daemon.approve("research")).value;
		daemon.finishTurn(launched, `Findings.${ending}`);
		const refused = yield* daemon.reconcile("research");
		expect(refused.decision?.code).toBe("report-revision");
		expect(refused.report).toBeUndefined();
	});
}
