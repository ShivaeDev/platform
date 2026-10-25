import { expect } from "@effect/vitest";
import { cycle } from "#engine/scheduler.ts";
import { executing } from "#model.ts";
import { busyThread, rejectedSubmission, submissionAtCapacity } from "#test/engineProviderRetryTraits.ts";
import { engine } from "#test/engineStory.ts";

const MESSAGE = "Selected model is at capacity";

for (const structured of [false, true]) {
	engine.it(
		`capacity clears on retry after restart: structured=${structured}`,
		[submissionAtCapacity(structured)],
		function* ({ setFleetTime, recoverProvider, fleet, prepareWork, afterRestart, launches, publishedDecisions, schedule }) {
			yield* prepareWork("one");

			yield* schedule();
			const queued = (yield* fleet.get("one")).value;
			expect(queued.step).toBe("queued");
			expect(queued.launchRetry).toEqual({ rejectedAt: 100, rejections: 1, retryAt: 30_100 });
			expect(executing(queued)).toBe(false);
			expect(publishedDecisions()).toHaveLength(0);
			recoverProvider();
			setFleetTime(30_099);
			yield* afterRestart(cycle);
			expect(launches()).toEqual(["operation-1"]);
			setFleetTime(30_100);
			yield* afterRestart(cycle);
			expect((yield* fleet.get("one")).value).toMatchObject({ step: "working" });
			expect((yield* fleet.get("one")).value.launchRetry).toBeUndefined();
			expect(launches()).toEqual(["operation-1", "operation-2"]);
		},
	);
}

engine.it(
	"capacity that never clears parks after five attempts across restarts",
	[submissionAtCapacity()],
	function* ({ advanceTime, currentTime, fleet, prepareWork, afterRestart, launches, publishedDecisions }) {
		yield* prepareWork("one");

		for (const delay of [30_000, 60_000, 120_000, 240_000]) {
			yield* afterRestart(cycle);
			const queued = (yield* fleet.get("one")).value;
			expect(queued.launchRetry?.retryAt).toBe(currentTime() + delay);
			expect(queued.decision).toBeUndefined();
			advanceTime(delay);
		}
		yield* afterRestart(cycle);
		const parked = (yield* fleet.get("one")).value;
		expect(parked.step).toBe("waiting");
		expect(parked.launchRetry).toBeUndefined();
		expect(parked.decision?.reason).toBe(`${MESSAGE}; provider failure after 5 attempts (4 automatic retries)`);
		expect(parked.attempts.map((entry) => entry.operationId)).toEqual(["operation-1", "operation-2", "operation-3", "operation-4", "operation-5"]);
		expect(executing(parked)).toBe(false);
		advanceTime(1_000_000);
		yield* afterRestart(cycle);
		expect(launches()).toEqual(["operation-1", "operation-2", "operation-3", "operation-4", "operation-5"]);
		expect(publishedDecisions()).toEqual([parked.decision?.reason]);
	},
);

for (const rejection of ["Rejected credential", "Request refused by policy"]) {
	engine.it(
		`${rejection} remains a human blocker`,
		[rejectedSubmission(rejection)],
		function* ({ fleet, prepareWork, afterRestart, launches, schedule }) {
			yield* prepareWork("one");

			yield* schedule();
			expect((yield* fleet.get("one")).value).toMatchObject({ decision: { reason: rejection }, step: "waiting" });
			expect((yield* fleet.get("one")).value.launchRetry).toBeUndefined();
			yield* afterRestart(cycle);
			expect(launches()).toEqual(["operation-1"]);
		},
	);
}

for (const rejection of ["turn already active for thread", "Codex rejected the protocol request: turn already active for thread"]) {
	engine.it(
		`busy rejection queues a fresh thread automatically: ${rejection}`,
		[busyThread(rejection)],
		function* ({ setFleetTime, recoverProvider, fleet, prepareWork, afterRestart, launches, publishedDecisions, providerStarts, schedule }) {
			yield* prepareWork("one");

			yield* schedule();
			const queued = (yield* fleet.get("one")).value;
			expect(queued.step).toBe("queued");
			expect(queued.attempts.at(-1)?.sessionUnusable).toBe(true);
			expect(publishedDecisions()).toHaveLength(0);
			recoverProvider();
			setFleetTime(30_100);
			yield* afterRestart(cycle);
			const accepted = (yield* fleet.get("one")).value;
			expect(accepted.step).toBe("working");
			expect(accepted.attempts.at(-1)?.receipt?.sessionId).not.toBe(queued.attempts.at(-1)?.sessionId);
			expect(providerStarts().at(-1)?.prompt).toContain("same branch and PR");
			expect(launches()).toEqual(["operation-1", "operation-2"]);
		},
	);
}
