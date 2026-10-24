import { Fiber } from "effect";
import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { readableBoard } from "#test/readableBoard.ts";

isolatedEngine.it(
	"a reconcile forked before sleep sees a Board edit made during the scheduler sleep",
	[readableBoard()],
	function* ({ boardScans, writeTrackedBoard, startBoardReadScheduler, prepareWork }) {
		const stored = yield* prepareWork("item.0");
		const schedule = yield* startBoardReadScheduler(stored);
		const before = boardScans();
		yield* schedule.dispatched;
		yield* schedule.sleeping;
		yield* writeTrackedBoard("0.md", "---\nid: item.0\nkind: task\nfleet: held\n---\n# item.0\n\nEdited during scheduler sleep.\n");
		yield* schedule.release;
		const reconciled = yield* schedule.read;
		expect(reconciled.approved).toBe(false);
		expect(reconciled.context).toContain("Edited during scheduler sleep.");
		yield* Fiber.interrupt(schedule.runner);
		expect(boardScans()).toBe(before + 2);
	},
);
