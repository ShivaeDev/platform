import { expect } from "@effect/vitest";
import { fakeCodex, publishedHostBranch } from "#test/hostScenarioTraits.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { humanDelivery, publishedBranch } from "#test/humanDelivery.ts";
import { stopWorkStory } from "#test/recoveryStories.ts";

host.it(stopWorkStory.name, [approvedWork(["one"]), humanDelivery, publishedBranch, publishedHostBranch, fakeCodex], function* (daemon) {
	const worker = yield* daemon.dispatch("one");
	const branch = daemon.workerBranchHead();
	const stopped = yield* daemon.cli(["stop", "one"]);
	expect(stopped).toEqual({
		code: 0,
		stderr: "",
		stdout: "one released: Work cancelled by orchestrator. Pull request preserved: https://github.com/example/repository/pull/7",
	});
	const record = yield* daemon.get("one");
	expect(record.step).toBe("released");
	expect(record.attempts).toMatchObject([{ receipt: worker.attempts[0]?.receipt, status: "interrupted" }]);
	expect(daemon.workerBranchHead()).toBe(branch);
	expect(daemon.githubMutations()).toEqual([]);
	yield* daemon.schedulerPass();
	expect((yield* daemon.get("one")).step).toBe("released");
	expect(daemon.readBoard(`responses/${record.responses?.at(-1)?.responseId}.md`)).toContain("Work cancelled by orchestrator.");
	expect(record.responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
	expect(daemon.boardAcknowledgements()).toMatchObject([{ disposition: "applied" }]);
	expect(daemon.codexTurnState(worker.attempts[0]?.receipt?.turnId ?? "")).toBe("interrupted");
	expect(daemon.codexRequests().filter((request) => request.method === "turn/interrupt")).toMatchObject([
		{ params: { threadId: worker.attempts[0]?.receipt?.sessionId, turnId: worker.attempts[0]?.receipt?.turnId } },
	]);
});
