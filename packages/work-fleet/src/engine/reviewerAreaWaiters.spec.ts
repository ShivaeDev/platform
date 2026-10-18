import { expect } from "vitest";
import { fleetStory, githubBacklog, immediateAreaRelease, sharedArea } from "#test/fleetStory.ts";
import { MOVED } from "#test/githubResult.ts";

fleetStory.it(
	"a fresh review of a moved PR head waits behind an earlier eligible area waiter",
	[githubBacklog, immediateAreaRelease, sharedArea],
	function* (fleet) {
		fleet.dependencies("two", ["dependency"]);
		yield* fleet.prepare("two");
		yield* fleet.prepare("one");
		yield* fleet.dispatch("one");
		yield* fleet.finishWorker("one");
		expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("reviewed-pr-ready");
		expect((yield* fleet.reconcile("one")).value.mergeAreasReleased).toBe(true);
		fleet.dependencies("two", []);
		fleet.movePrHeadOnGithub(MOVED);
		const waiting = yield* fleet.reconcile("one");
		expect(waiting.value.blocker).toBe("waiting for area shared queued ahead by two");
		expect(waiting.value.attempts.filter((attempt) => attempt.reviewHead === MOVED)).toEqual([]);
		expect(fleet.launched).toHaveLength(2);
		expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
		expect((yield* fleet.reconcile("one")).value.blocker).toBe("waiting for area shared held by two");
		yield* fleet.workerQuestion("two", "Should I continue?");
		yield* fleet.reconcile("two");
		yield* fleet.answerDecision("two", "release");
		const reviewed = yield* fleet.reconcile("one");
		expect(reviewed.value.review).toMatchObject({ head: MOVED, verdict: "approved" });
		expect(reviewed.value.blocker).toBeUndefined();
		expect(fleet.launched).toHaveLength(4);
	},
);
