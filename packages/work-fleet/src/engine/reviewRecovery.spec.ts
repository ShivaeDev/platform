import { expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";

engine.it(
	"a reviewer without progress snapshots reports a stall at the worker threshold and retries independently",
	[reviewerStillRunning()],
	function* ({ prepareWork, dispatch, finishWorkers, reconcile, advanceTime, resolve, respond, providerStarts, publishedDecisions }) {
		yield* prepareWork("one");
		yield* dispatch("one");
		finishWorkers();
		const reviewing = yield* reconcile("one");
		advanceTime(29 * 60_000);
		expect((yield* reconcile("one")).value.step).toBe("reviewing");

		advanceTime(2 * 60_000);
		const stalled = yield* reconcile("one");

		expect(stalled.value).toMatchObject({ decision: { code: "session-stalled" }, step: "waiting" });
		expect(publishedDecisions()).toContain("Provider turn showed no activity for 30 minutes");
		const id = stalled.value.decision?.id ?? "missing";

		yield* resolve("one", id, respond(id, "retry"));
		const retried = yield* reconcile("one");

		expect(retried.value).toMatchObject({ result: reviewing.value.result, step: "reviewing" });
		expect(retried.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(reviewing.value.attempts.at(-1)?.receipt?.sessionId);
		expect(providerStarts().at(-1)).toMatchObject({
			access: "read-only",
			prompt: expect.stringContaining(reviewing.value.result?.head ?? "missing"),
		});
	},
);

for (const stalled of [false, true]) {
	engine.it(
		`a conflict during ${stalled ? "stalled" : "active"} review interrupts the reviewer and sends merge-main to the existing worker`,
		[githubPullRequest(), reviewerStillRunning()],
		function* ({ prepareWork, dispatch, finishWorker, reconcile, advanceTime, conflictPullRequest, providerInterrupts, turnOutput }) {
			yield* prepareWork("one");
			const worker = yield* dispatch("one");
			yield* finishWorker("one");
			const reviewing = yield* reconcile("one");
			expect(reviewing.value.step).toBe("reviewing");
			if (stalled) {
				advanceTime(31 * 60_000);
				expect((yield* reconcile("one")).value.decision?.code).toBe("session-stalled");
			}

			conflictPullRequest();
			const repairing = yield* reconcile("one");

			expect(providerInterrupts()).toEqual([reviewing.value.attempts.at(-1)?.receipt]);
			expect(repairing.value.step).toBe("working");
			expect(repairing.value.review).toBeUndefined();
			expect(repairing.value.attempts.at(-1)).toMatchObject({ receipt: { sessionId: worker.value.attempts[0]?.receipt?.sessionId }, role: "repair" });
			expect(turnOutput(repairing.value.attempts.at(-1)?.receipt)).toContain("Fetch and merge main once");
		},
	);
}

engine.it(
	"provider activity without progress snapshots postpones a review stall until activity stops",
	[reviewerStillRunning()],
	function* ({ prepareWork, dispatch, finishWorkers, reconcile, advanceTime, currentTime, reportTurnActivity }) {
		yield* prepareWork("one");
		yield* dispatch("one");
		finishWorkers();
		const reviewing = yield* reconcile("one");
		advanceTime(29 * 60_000);
		reportTurnActivity(reviewing.value.attempts.at(-1)?.receipt, currentTime());

		advanceTime(2 * 60_000);
		expect((yield* reconcile("one")).value.step).toBe("reviewing");

		advanceTime(29 * 60_000);
		expect((yield* reconcile("one")).value.decision?.code).toBe("session-stalled");
	},
);
