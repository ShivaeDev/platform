import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { expect } from "vitest";
import { engine, isolatedEngine } from "#test/engineStory.ts";
import { githubPullRequest, markdownWork, noChangeReported, oneExecutionSlot, reviewerStillRunning } from "#test/engineTraits.ts";
import { stopConfirmationHeld } from "#test/stopConfirmationHeld.ts";

isolatedEngine.it(
	"stopping waits for terminal execution and admits the same-area waiter",
	[oneExecutionSlot, stopConfirmationHeld("terminal")],
	function* ({ fleet, prepareWork, setAreas, waitForTimingGate, releaseTimingGate, providerInterrupts, schedule }) {
		setAreas("one", ["shared"]);
		setAreas("two", ["shared"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		const working = yield* fleet.dispatch("one");
		yield* fleet.dispatch("two").pipe(Effect.result);
		expect((yield* fleet.get("two")).value.step).toBe("queued");
		const stopping = yield* fleet.stop("one").pipe(Effect.forkChild);
		yield* waitForTimingGate();
		expect(providerInterrupts()).toEqual([working.value.attempts[0]?.receipt]);
		expect((yield* fleet.get("one")).value.step).toBe("waiting");
		yield* releaseTimingGate();
		const stopped = yield* Fiber.join(stopping);
		expect(stopped.value.step).toBe("released");
		yield* schedule();
		expect((yield* fleet.get("two")).value.step).toBe("working");
	},
);

engine.it(
	"stopping an active reviewer keeps the open PR and returns its URL",
	[githubPullRequest(), reviewerStillRunning()],
	function* ({ fleet, prepareWork, finishWorker, providerInterrupts, githubMutations }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* finishWorker("one");
		const reviewing = yield* fleet.reconcile("one");
		expect(reviewing.value.step).toBe("reviewing");
		const stopped = yield* fleet.stop("one");
		expect(stopped.value.step).toBe("released");
		expect(providerInterrupts()).toEqual([reviewing.value.attempts.at(-1)?.receipt]);
		expect(stopped.value.releaseReason).toContain("https://github.com/example/repository/pull/7");
		expect(githubMutations()).toEqual([]);
	},
);

engine.it(
	"dropping a working Board brief stops its provider turn without a release answer",
	[markdownWork()],
	function* ({ fleet, prepareWork, writeBoardWork, boardBrief, providerInterrupts, readBoardWork }) {
		yield* prepareWork("one");
		const working = yield* fleet.dispatch("one");
		writeBoardWork("one.md", boardBrief().replace("kind: task", "kind: task\nstatus: dropped"));
		const stopped = yield* fleet.reconcile("one");
		expect(stopped.value.step).toBe("released");
		expect(providerInterrupts()).toEqual([working.value.attempts[0]?.receipt]);
		expect(readBoardWork(`responses/${stopped.value.responses?.at(-1)?.responseId}.md`)).toContain("Work cancelled because Board status is dropped.");
	},
);

isolatedEngine.it(
	"an unconfirmed interrupt abandons the turn, frees its slot and areas and ignores late output after restart",
	[oneExecutionSlot, stopConfirmationHeld("interrupt")],
	function* ({ fleet, prepareWork, setAreas, waitForTimingGate, providerInterrupts, setTurnExecution, restart, schedule }) {
		setAreas("one", ["shared"]);
		setAreas("two", ["shared"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		const working = yield* fleet.dispatch("one");
		yield* fleet.dispatch("two").pipe(Effect.result);
		const stopping = yield* fleet.stop("one").pipe(Effect.forkChild);
		yield* waitForTimingGate();
		yield* TestClock.adjust("5 seconds");
		const stopped = yield* Fiber.join(stopping);
		expect(stopped.value).toMatchObject({
			attempts: [{ abandoned: { interruptError: expect.any(String) }, sessionUnusable: true, status: "failed" }],
			step: "released",
		});
		expect(providerInterrupts()).toEqual([working.value.attempts[0]?.receipt]);
		yield* restart();
		yield* schedule();
		expect((yield* fleet.get("two")).value.step).toBe("working");
		const receipt = working.value.attempts[0]?.receipt;
		if (receipt === undefined) {
			throw new Error("Worker receipt missing");
		}
		setTurnExecution(receipt, "completed", "Late result that must be ignored");
		const later = yield* fleet.reconcile("one");
		expect(later.value.step).toBe("released");
		expect(later.value.attempts[0]?.output).toBeUndefined();
		expect(later.value.result).toBeUndefined();
	},
);

engine.it("stopping finished, released or unknown work names its state", [noChangeReported()], function* ({ fleet, prepareWork, finishWorkers }) {
	yield* prepareWork("one");
	yield* fleet.dispatch("one");
	finishWorkers();
	expect((yield* fleet.reconcile("one")).value.step).toBe("done");
	expect(yield* fleet.stop("one").pipe(Effect.flip)).toMatchObject({ message: expect.stringContaining("done") });
	yield* prepareWork("two");
	yield* fleet.stop("two");
	expect(yield* fleet.stop("two").pipe(Effect.flip)).toMatchObject({ message: expect.stringContaining("released") });
	expect(yield* fleet.stop("missing-task").pipe(Effect.flip)).toMatchObject({ message: "Unknown Board work missing-task" });
});
