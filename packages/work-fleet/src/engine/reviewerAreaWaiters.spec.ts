import { expect } from "vitest";
import { githubBacklog, immediateAreaRelease, sharedArea } from "#test/engineSchedulingTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { MOVED } from "#test/githubResult.ts";

isolatedEngine.it(
	"a fresh review of a moved PR head waits behind an earlier eligible area waiter",
	[githubBacklog, immediateAreaRelease, sharedArea],
	function* (fleet) {
		fleet.setDependencies("two", ["dependency"]);
		yield* fleet.prepareWork("two");
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		yield* fleet.finishWorker("one");
		expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("reviewed-pr-ready");
		expect((yield* fleet.reconcile("one")).value.mergeAreasReleased).toBe(true);
		fleet.setDependencies("two", []);
		fleet.movePullRequestHead(MOVED);
		const waiting = yield* fleet.reconcile("one");
		expect(waiting.value.blocker).toBe("waiting for area shared queued ahead by two");
		expect(waiting.value.attempts.filter((attempt) => attempt.reviewHead === MOVED)).toEqual([]);
		expect(fleet.launches()).toHaveLength(2);
		expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
		expect((yield* fleet.reconcile("one")).value.blocker).toBe("waiting for area shared held by two");
		yield* fleet.workerQuestion("two", "Should I continue?");
		yield* fleet.reconcile("two");
		yield* fleet.answerDecision("two", "release");
		const reviewed = yield* fleet.reconcile("one");
		expect(reviewed.value.review).toMatchObject({ head: MOVED, verdict: "approved" });
		expect(reviewed.value.blocker).toBeUndefined();
		expect(fleet.launches()).toHaveLength(4);
	},
);
