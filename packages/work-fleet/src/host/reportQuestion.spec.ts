import { expect } from "@effect/vitest";
import { boardWork, host } from "#test/hostStory.ts";

const SOURCE = "---\nid: one\nkind: task\nfleet: approved\ndelivers: report\n---\n# Research\n";

host.it("report questions continue read-only research and record the final answer turn", [boardWork({ "one.md": SOURCE })], function* (daemon) {
	yield* daemon.approve("one");
	const { decision } = yield* daemon.askWorker();
	yield* daemon.answerWorker(decision);
	const resumed = yield* daemon.reconcile("one");
	const attempt = resumed.attempts.at(-1);
	expect(attempt?.prompt).toContain("Use **PostgreSQL**");
	expect(attempt?.prompt).toContain("Leave repository sources unchanged. Commit nothing, push nothing, and open no PR");
	const receipt = attempt?.receipt;
	if (receipt === undefined) {
		throw new Error("Expected the report answer turn receipt");
	}
	expect(receipt.sessionId).toBe(decision.worker?.sessionId);
	daemon.finishTurn(resumed, "# Findings after the answer\n");
	const completed = yield* daemon.reconcile("one");
	expect(completed.step).toBe("done");
	expect(completed.report?.receipt).toEqual(receipt);
	expect(daemon.providerLaunches()).toHaveLength(1);
	yield* daemon.awaitBoardText("fleet/status.md", "Stage: done");
	const status = daemon.readBoard("fleet/status.md");
	expect(status).toContain("## Done");
	expect(status).toContain("Stage: done");
});
