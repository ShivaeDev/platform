import { expect } from "@effect/vitest";
import { lostAcknowledgement, publishedWork, workerTurnsCanBeLost } from "#test/engineLostTurnTraits.ts";
import { engine } from "#test/engineStory.ts";
import { reviewerStillRunning, reviewRequestsRepairs } from "#test/engineTraits.ts";
import { WORK_BRANCH, WORK_PR } from "#test/workPublication.ts";

for (const receiptLost of [false, true]) {
	engine.it(
		`a lost active thread ${receiptLost ? "without" : "with"} a receipt keeps its reservation through grace and asks instead of duplicating work`,
		[workerTurnsCanBeLost(), ...(receiptLost ? [lostAcknowledgement()] : [])],
		function* ({ fleet, prepareWork, restart, loseTurn, threadActive, threadIdle, advanceTime, respond, status, launches, publishedDecisions }) {
			yield* prepareWork("one");
			const first = (yield* fleet.dispatch("one")).value;
			const session = first.attempts.at(-1)?.sessionId;
			if (session === undefined) {
				throw new Error("Expected the accepted thread");
			}
			loseTurn(session);
			threadActive(session);
			const waiting = (yield* fleet.reconcile("one")).value;
			expect(waiting.step).toBe("working");
			expect(waiting.blocker).toContain("thread remains active");
			expect(yield* status()).toContain("Waiting on automation (1)");
			expect(launches()).toEqual(["operation-1"]);
			expect(publishedDecisions()).toEqual([]);
			yield* restart();
			advanceTime(299_999);
			expect((yield* fleet.reconcile("one")).value.step).toBe("working");
			advanceTime(1);
			const parked = (yield* fleet.reconcile("one")).value;
			expect(parked.decision?.reason).toContain("thread remains active after the visibility grace period");
			expect(launches()).toEqual(["operation-1"]);
			if (parked.decision === undefined) {
				throw new Error("Expected an active-thread decision");
			}
			respond(parked.decision.id, "release");
			expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
			respond(parked.decision.id, "retry");
			expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
			expect(launches()).toEqual(["operation-1"]);
			threadIdle(session);
			yield* restart();
			expect((yield* fleet.reconcile("one")).value.step).toBe("working");
			expect(launches()).toEqual(["operation-1", "operation-2"]);
		},
	);
}

for (const state of ["merged", "closed"] as const) {
	engine.it(
		`a ${state} PR with its branch deleted prevents a lost-turn relaunch`,
		[workerTurnsCanBeLost(), lostAcknowledgement()],
		function* ({ fleet, prepareWork, restart, loseTurn, publishPullRequest, respond, launches }) {
			yield* prepareWork("one");
			loseTurn((yield* fleet.dispatch("one")).value.attempts.at(-1)?.sessionId);
			publishPullRequest(state);
			const parked = (yield* fleet.reconcile("one")).value;
			expect(parked.step).toBe("waiting");
			expect(parked.decision?.reason).toContain(`is ${state}`);
			expect(launches()).toEqual(["operation-1"]);
			if (parked.decision === undefined) {
				throw new Error("Expected a delivery decision");
			}
			respond(parked.decision.id, "retry");
			yield* restart();
			expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
			expect(launches()).toEqual(["operation-1"]);
		},
	);
}

for (const receiptLost of [false, true]) {
	for (const published of ["none", "branch", "pr"] as const) {
		engine.it(
			`a second loss with ${published} after ${receiptLost ? "losing" : "receiving"} the first receipt recovers automatically`,
			[workerTurnsCanBeLost(), publishedWork(published), ...(receiptLost ? [lostAcknowledgement()] : [])],
			function* ({ fleet, prepareWork, restart, loseTurn, advanceTime, launches, providerStarts, publishedDecisions }) {
				yield* prepareWork("one");
				const first = (yield* fleet.dispatch("one")).value;
				loseTurn(first.attempts.at(-1)?.sessionId);
				yield* fleet.reconcile("one");
				advanceTime(300_000);
				const recovered = (yield* fleet.reconcile("one")).value;
				expect(launches()).toEqual(["operation-1", "operation-2"]);
				expect(recovered.prompt).toBe(first.prompt);
				loseTurn(recovered.attempts.at(-1)?.sessionId);
				yield* fleet.reconcile("one");
				advanceTime(300_000);
				yield* restart();
				const replacement = (yield* fleet.reconcile("one")).value;
				expect(replacement.step).toBe("working");
				expect(replacement.decision).toBeUndefined();
				expect(publishedDecisions()).toHaveLength(0);
				expect(replacement.attempts.at(-1)?.role).toBe(published === "none" ? "worker" : "repair");
				expect(replacement.prompt).toBe(first.prompt);
				const prompt = providerStarts().at(-1)?.prompt;
				expect(prompt?.match(new RegExp(RegExp.escape(first.prompt), "gu"))).toEqual([first.prompt]);
				expect(prompt?.match(/Accepted Codex turn is not observable/gu)).toEqual(["Accepted Codex turn is not observable"]);
				if (published !== "none") {
					expect(prompt).toContain(`existing branch ${WORK_BRANCH}`);
				}
				if (published === "pr") {
					expect(prompt).toContain(WORK_PR);
				}
				expect(launches()).toEqual(["operation-1", "operation-2", "operation-3"]);
			},
		);
	}
}

engine.it(
	"a lost repair after a done replacement rechecks the current PR and recovers automatically",
	[workerTurnsCanBeLost(), lostAcknowledgement(), reviewerStillRunning(), reviewRequestsRepairs()],
	function* ({ fleet, prepareWork, restart, loseTurn, finishWorkers, publishPullRequest, advanceTime, publishedDecisions }) {
		yield* prepareWork("one");
		loseTurn((yield* fleet.dispatch("one")).value.attempts.at(-1)?.sessionId);
		yield* fleet.reconcile("one");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.step).toBe("reviewing");
		finishWorkers();
		const repair = (yield* fleet.reconcile("one")).value;
		expect(repair.attempts.at(-1)?.role).toBe("repair");
		publishPullRequest();
		loseTurn(repair.attempts.at(-1)?.sessionId);
		yield* fleet.reconcile("one");
		advanceTime(300_000);
		yield* restart();
		const recovered = (yield* fleet.reconcile("one")).value;
		expect(recovered.step).toBe("working");
		expect(recovered.decision).toBeUndefined();
		expect(recovered.attempts.at(-1)?.role).toBe("repair");
		expect(recovered.attempts.at(-1)?.sessionId).not.toBe(repair.attempts.at(-1)?.sessionId);
		expect(recovered.attempts.at(-1)?.prompt).toContain(WORK_PR);
		expect(publishedDecisions()).toHaveLength(0);
	},
);
