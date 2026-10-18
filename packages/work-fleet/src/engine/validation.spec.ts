import { expect } from "@effect/vitest";
import { checksAreQueued, checksAreRunning, newPushIsGreen, requiredCheckKeepsFailing } from "#test/engineCheckTraits.ts";
import { engine } from "#test/engineStory.ts";
import { ADOPTED_HEAD, checkRun, NEW_HEAD } from "#test/githubChecks.ts";

engine.it(
	"publishes an orchestrator decision after three repairs leave the same required check failing, including after restart",
	[requiredCheckKeepsFailing()],
	function* ({
		fleet,
		prepareWork,
		finishWorkers,
		restart,
		movePullRequestHead,
		checksRespond,
		currentPullRequestHead,
		publishedDecisions,
		launches,
		mergedHeads,
	}) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		for (let repair = 0; repair < 3; repair += 1) {
			finishWorkers();
			const repairing = yield* fleet.reconcile("one");
			expect(repairing.value.stage).toBe("executing");
			expect(repairing.value.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(repair + 1);
			movePullRequestHead(String(repair + 1).repeat(40));
			checksRespond(currentPullRequestHead(), [[checkRun({ conclusion: "failure", headSha: currentPullRequestHead(), name: "verify" })]]);
		}
		finishWorkers();
		yield* restart();
		const stopped = yield* fleet.reconcile("one");
		expect(stopped.value.stage).toBe("needs-human");
		expect(stopped.value.decision).toMatchObject({ attentionOwner: "orchestrator", reason: expect.stringContaining("verify") });
		expect(stopped.value.decisionPublished).toBe(true);
		expect(publishedDecisions()).toHaveLength(1);
		expect(stopped.value.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(3);
		const launched = launches().length;
		yield* fleet.reconcile("one");
		expect(launches()).toHaveLength(launched);
		expect(mergedHeads()).toHaveLength(0);
	},
);
engine.it(
	"pending checks survive restart in validation, then deliver when the adopted SHA turns green",
	[checksAreQueued()],
	function* ({ fleet, prepareWork, finishWorkers, restart, publishedDecisions, mergedHeads, launches, checksRespond, reviewedHeads }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const pending = yield* fleet.reconcile("one");
		expect(pending.value.stage).toBe("validating");
		expect(pending.value.checks).toMatchObject({ head: ADOPTED_HEAD, pending: true });
		yield* restart();
		expect((yield* fleet.reconcile("one")).value.stage).toBe("validating");
		expect(publishedDecisions()).toHaveLength(0);
		expect(mergedHeads()).toHaveLength(0);
		expect(launches()).toHaveLength(2);
		checksRespond(ADOPTED_HEAD, [[checkRun()]]);
		const completed = yield* fleet.reconcile("one");
		expect(completed.value.stage).toBe("completed");
		expect(completed.value.checks).toMatchObject({ head: ADOPTED_HEAD, passed: true, pending: false });
		expect(mergedHeads()).toEqual([ADOPTED_HEAD]);
		expect(reviewedHeads()).toHaveLength(1);
	},
);
engine.it(
	"pending checks that fail send names and logs to repair and revalidate its new head",
	[checksAreRunning()],
	function* ({ fleet, prepareWork, finishWorkers, checksRespond, turnOutput, mergedHeads, publishedDecisions, movePullRequestHead, reviewedHeads }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.stage).toBe("validating");
		checksRespond(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "build" })]]);
		const repair = yield* fleet.reconcile("one");
		expect(repair.value.stage).toBe("executing");
		const attempt = repair.value.attempts.at(-1);
		expect(attempt?.role).toBe("repair");
		const prompt = turnOutput(attempt?.receipt);
		expect(prompt).toContain("build: https://example.invalid/logs/test");
		expect(prompt).toContain(ADOPTED_HEAD);
		expect(mergedHeads()).toHaveLength(0);
		expect(publishedDecisions()).toHaveLength(0);
		movePullRequestHead(NEW_HEAD);
		checksRespond(NEW_HEAD, [[checkRun({ headSha: NEW_HEAD })]]);
		finishWorkers();
		const completed = yield* fleet.reconcile("one");
		expect(completed.value.stage).toBe("completed");
		expect(completed.value.checks?.head).toBe(NEW_HEAD);
		expect(reviewedHeads()).toEqual([ADOPTED_HEAD, NEW_HEAD]);
	},
);
engine.it(
	"a newer green push leaves the adopted pending head in validation",
	[newPushIsGreen()],
	function* ({ fleet, prepareWork, finishWorkers, mergedHeads, githubRequests }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.stage).toBe("validating");
		expect((yield* fleet.reconcile("one")).value.checks?.head).toBe(ADOPTED_HEAD);
		expect(mergedHeads()).toHaveLength(0);
		expect(
			githubRequests()
				.filter((request) => request.includes("/commits/"))
				.every((request) => request.includes(ADOPTED_HEAD)),
		).toBe(true);
	},
);
