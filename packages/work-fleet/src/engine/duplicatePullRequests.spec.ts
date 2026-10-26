import { expect } from "@effect/vitest";
import { lostAcknowledgement, workerTurnsCanBeLost } from "#test/engineLostTurnTraits.ts";
import { engine } from "#test/engineStory.ts";
import { WORK_BRANCH, workPr } from "#test/workPublication.ts";

engine.it(
	"a closed duplicate PR on the worker branch leaves the open PR as published work",
	[workerTurnsCanBeLost(), lostAcknowledgement()],
	function* ({ fleet, prepareWork, loseTurn, publishPullRequests }) {
		yield* prepareWork("one");
		loseTurn((yield* fleet.dispatch("one")).value.attempts.at(-1)?.sessionId);
		publishPullRequests("closed", "open");
		const repaired = (yield* fleet.reconcile("one")).value;
		expect(repaired.attempts.at(-1)?.role).toBe("repair");
		expect(repaired.attempts.at(-1)?.prompt).toContain(`PR ${workPr(1)}`);
		expect(repaired.attempts.at(-1)?.prompt).not.toContain(workPr(0));
	},
);

engine.it(
	"a merged PR wins over a closed duplicate on the worker branch",
	[workerTurnsCanBeLost(), lostAcknowledgement()],
	function* ({ fleet, prepareWork, loseTurn, publishPullRequests }) {
		yield* prepareWork("one");
		loseTurn((yield* fleet.dispatch("one")).value.attempts.at(-1)?.sessionId);
		publishPullRequests("merged", "closed");
		const parked = (yield* fleet.reconcile("one")).value;
		expect(parked.step).toBe("waiting");
		expect(parked.decision?.reason).toContain(`PR ${workPr(0)} is merged`);
	},
);

engine.it(
	"two open PRs on the worker branch wait as ambiguous published work",
	[workerTurnsCanBeLost(), lostAcknowledgement()],
	function* ({ fleet, prepareWork, loseTurn, publishPullRequests, launches }) {
		yield* prepareWork("one");
		loseTurn((yield* fleet.dispatch("one")).value.attempts.at(-1)?.sessionId);
		publishPullRequests("open", "closed", "open");
		const parked = (yield* fleet.reconcile("one")).value;
		expect(parked.step).toBe("waiting");
		expect(parked.decision?.reason).toContain(`Several open or merged PRs use ${WORK_BRANCH}`);
		expect(launches()).toEqual(["operation-1"]);
	},
);
