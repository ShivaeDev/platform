import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { readableBoard } from "#test/readableBoard.ts";

for (const source of [".", "0.md"]) {
	isolatedEngine.it(
		`an incomplete Board read retries without losing execution: ${source}`,
		[readableBoard()],
		function* ({ boardScans, makeBoardUnreadable, restoreBoardReads, launches, advanceTime, prepareWork, restart, fleet, schedule }) {
			yield* prepareWork("item.0");
			yield* fleet.dispatch("item.0");
			makeBoardUnreadable(source);
			const waiting = (yield* fleet.reconcile("item.0")).value;
			expect(waiting.step).toBe("working");
			expect(waiting.decision).toBeUndefined();
			expect(waiting.attentionOwner).toBe("automation");
			expect(waiting.blocker).toContain(source === "." ? "Board sources could not be listed" : "Board source could not be read");
			expect(waiting.integrationRetry).toMatchObject({ failures: 1, retryAt: 30_100 });
			const scans = boardScans();
			advanceTime(29_999);
			yield* restart();
			yield* schedule();
			expect(boardScans()).toBe(scans);
			restoreBoardReads();
			advanceTime(1);
			yield* restart();
			yield* schedule();
			const recovered = (yield* fleet.get("item.0")).value;
			expect(recovered.step).toBe("working");
			expect(recovered.decision).toBeUndefined();
			expect(recovered.integrationRetry).toBeUndefined();
			expect(recovered.blocker).toBeUndefined();
			expect(recovered.attentionOwner).toBeUndefined();
			expect(recovered.attempts).toEqual(waiting.attempts);
			expect(launches()).toEqual(["operation-1"]);
		},
		{ clock: "live" },
	);
}

isolatedEngine.it(
	"five incomplete Board reads retain one decision and publish it when the Board returns",
	[readableBoard()],
	function* ({ makeBoardUnreadable, restoreBoardReads, launches, advanceTime, currentTime, prepareWork, restart, fleet, schedule }) {
		yield* prepareWork("item.0");
		yield* fleet.dispatch("item.0");
		makeBoardUnreadable(".");
		for (let failure = 1; failure <= 5; failure += 1) {
			const failed = (yield* fleet.reconcile("item.0")).value;
			if (failure < 5) {
				expect(failed.decision).toBeUndefined();
				expect(failed.integrationRetry).toMatchObject({ failures: failure });
				if (failed.integrationRetry === undefined) {
					throw new Error("Missing Board read retry");
				}
				advanceTime(failed.integrationRetry.retryAt - currentTime());
			}
		}
		const parked = (yield* fleet.get("item.0")).value;
		expect(parked.step).toBe("waiting");
		expect(parked.decision?.reason).toContain("read failure after 5 attempts");
		expect(parked.decisionPublished).toBe(false);
		expect((yield* fleet.reconcile("item.0")).value.decision).toEqual(parked.decision);
		restoreBoardReads();
		yield* restart();
		yield* schedule();
		const published = (yield* fleet.get("item.0")).value;
		expect(published.decision?.id).toBe(parked.decision?.id);
		expect(published.decisionPublished).toBe(true);
		yield* restart();
		yield* schedule();
		expect((yield* fleet.get("item.0")).value.decision).toEqual(published.decision);
		expect(launches()).toEqual(["operation-1"]);
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"an incomplete Board read before dispatch waits for its deadline and submits once",
	[readableBoard()],
	function* ({ boardScans, makeBoardUnreadable, restoreBoardReads, launches, advanceTime, prepareWork, restart, fleet, schedule }) {
		yield* prepareWork("item.0");
		makeBoardUnreadable(".");
		const waiting = (yield* fleet.dispatch("item.0")).value;
		expect(waiting.step).toBe("queued");
		expect(waiting.decision).toBeUndefined();
		expect(waiting.attentionOwner).toBe("automation");
		expect(waiting.integrationRetry).toMatchObject({ failures: 1, retryAt: 30_100 });
		const scans = boardScans();
		yield* restart();
		yield* schedule();
		expect(boardScans()).toBe(scans);
		expect((yield* fleet.get("item.0")).value.integrationRetry).toEqual(waiting.integrationRetry);
		restoreBoardReads();
		advanceTime(30_000);
		yield* restart();
		yield* schedule();
		const recovered = (yield* fleet.get("item.0")).value;
		expect(recovered.step).toBe("working");
		expect(recovered.integrationRetry).toBeUndefined();
		expect(recovered.blocker).toBeUndefined();
		expect(recovered.attentionOwner).toBeUndefined();
		expect(launches()).toEqual(["operation-1"]);
	},
	{ clock: "live" },
);
