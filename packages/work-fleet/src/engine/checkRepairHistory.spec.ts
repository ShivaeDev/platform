import { expect } from "@effect/vitest";
import { optionalCheckFails, requiredChecksFailInSequence, reviewAndCheckNeedRepairs } from "#test/engineCheckTraits.ts";
import { engine } from "#test/engineStory.ts";
import { ADOPTED_HEAD, checkRun } from "#test/githubChecks.ts";

engine.it(
	"a non-required failure never launches repair after approval",
	[optionalCheckFails()],
	function* ({ fleet, prepareWork, finishWorkers, publishedDecisions }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const completed = yield* fleet.reconcile("one");
		expect(completed.value.stage).toBe("completed");
		expect(completed.value.checks?.passed).toBe(true);
		expect(completed.value.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(0);
		expect(publishedDecisions()).toHaveLength(0);
	},
);
engine.it(
	"a different failing required name starts a new repair sequence",
	[requiredChecksFailInSequence()],
	function* ({ fleet, prepareWork, finishWorkers, checksRespond, publishedDecisions }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		for (let repair = 0; repair < 3; repair += 1) {
			finishWorkers();
			yield* fleet.reconcile("one");
		}
		checksRespond(ADOPTED_HEAD, [[checkRun({ name: "verify" }), checkRun({ conclusion: "failure", name: "build" })]]);
		finishWorkers();
		const repairing = yield* fleet.reconcile("one");
		expect(repairing.value.stage).toBe("executing");
		expect(repairing.value.attempts.at(-1)?.checkFailures).toEqual(["build"]);
		expect(repairing.value.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(4);
		expect(publishedDecisions()).toHaveLength(0);
	},
);
engine.it(
	"review repair does not count as a check repair",
	[reviewAndCheckNeedRepairs()],
	function* ({ fleet, prepareWork, finishWorkers, publishedDecisions }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const reviewRepair = yield* fleet.reconcile("one");
		expect(reviewRepair.value.attempts.at(-1)?.checkFailures).toBeUndefined();
		for (let repair = 0; repair < 3; repair += 1) {
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.stage).toBe("executing");
		}
		finishWorkers();
		const stopped = yield* fleet.reconcile("one");
		expect(stopped.value.stage).toBe("needs-human");
		expect(stopped.value.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(4);
		expect(publishedDecisions()).toHaveLength(1);
	},
);
