import { expect } from "@effect/vitest";
import { lostAcknowledgement, publishedWork, workerTurnsCanBeLost } from "#test/engineLostTurnTraits.ts";
import { engine } from "#test/engineStory.ts";
import { WORK_BRANCH, WORK_PR } from "#test/workPublication.ts";

for (const published of ["branch", "pr"] as const) {
	for (const rejection of ["session", "turn"] as const) {
		engine.it(
			`a receiptless ${published} repair retries a capacity-rejected replacement ${rejection} after restart`,
			[workerTurnsCanBeLost(), lostAcknowledgement(), publishedWork(published)],
			function* ({ fleet, prepareWork, restart, schedule, loseTurn, rejectNextSubmission, advanceTime, publishedDecisions }) {
				yield* prepareWork("one");
				const original = (yield* fleet.dispatch("one")).value.attempts.at(-1);
				expect(original?.receipt).toBeUndefined();
				loseTurn(original?.sessionId);
				rejectNextSubmission(rejection);
				const rejected = (yield* fleet.reconcile("one")).value;
				expect(rejected.step).toBe("repairing");
				expect(rejected.decision).toBeUndefined();
				expect(rejected.launchRetry).toMatchObject({ rejections: 1, retryAt: 30_100 });
				expect(rejected.attempts.at(-1)).toMatchObject({ output: "Replacement capacity unavailable", role: "repair", status: "failed" });
				expect(rejected.attempts.at(-1)?.sessionUnusable).toBeUndefined();
				yield* restart();
				advanceTime(29_999);
				yield* schedule();
				expect((yield* fleet.get("one")).value.attempts).toHaveLength(2);
				advanceTime(1);
				yield* schedule();
				const resumed = (yield* fleet.get("one")).value;
				expect(resumed.step).toBe("working");
				expect(resumed.launchRetry).toBeUndefined();
				expect(resumed.decision).toBeUndefined();
				expect(resumed.attempts).toHaveLength(3);
				expect(resumed.attempts.at(-1)).toMatchObject({ role: "repair", status: "accepted" });
				expect(resumed.attempts.at(-1)?.receipt).toBeDefined();
				expect(resumed.attempts.at(-1)?.sessionId).not.toBe(original?.sessionId);
				expect(resumed.attempts.at(-1)?.prompt).toContain(WORK_BRANCH);
				if (published === "pr") {
					expect(resumed.attempts.at(-1)?.prompt).toContain(WORK_PR);
				}
				yield* schedule();
				expect((yield* fleet.get("one")).value.attempts.at(-1)?.status).toBe("running");
				expect(publishedDecisions()).toEqual([]);
			},
		);
	}
}
