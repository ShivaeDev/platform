import { expect } from "@effect/vitest";
import { executing } from "#model.ts";
import { task } from "#test/fleetHost.ts";
import { hostMissingTurns } from "#test/hostMissingTurns.ts";
import { approvedWork, host } from "#test/hostStory.ts";

for (const command of [["answer", "--release"], ["release"]]) {
	host.it(
		`closed and open tasks release legacy lost recorded turns through ${command.join(" ")} without starting or resuming a turn`,
		[approvedWork(["one", "two"]), hostMissingTurns],
		function* (daemon) {
			for (const workId of ["one", "two"]) {
				yield* daemon.dispatch(workId);
				const waiting = yield* daemon.reconcile(workId);
				expect(waiting.step).toBe("waiting");
				expect(executing(waiting)).toBe(true);
				expect(waiting.attempts[0]?.receipt).toBeDefined();
			}
			daemon.writeBoard("one.md", task("one", "approved").replace("kind: task", "kind: task\nstatus: done"));
			const closed = yield* daemon.reconcile("one");
			expect(closed.step).toBe("released");
			expect(closed.releaseReason).toBe("Board status is done");
			expect(executing(closed)).toBe(false);
			expect((yield* daemon.reconcile("two")).step).toBe("waiting");
			expect(yield* daemon.cli([...command, "two"])).toEqual({
				code: 0,
				stderr: "",
				stdout: "two waiting (waiting on automation): Answer recorded; applying in the background",
			});
			const open = yield* daemon.appliedAnswer("two");
			expect(open.step).toBe("released");
			expect(executing(open)).toBe(false);
			expect(open.responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
			expect(daemon.receiptFiles()).toHaveLength(2);
			expect(daemon.providerCalls().filter((call) => call.call === "turn")).toHaveLength(2);
			expect(daemon.providerLaunches()).toHaveLength(2);
			expect(daemon.missingTurnRequests()).not.toContain("turn/start");
			expect(daemon.missingTurnRecoveries().every((input) => input.resume === undefined)).toBe(true);
		},
		30_000,
	);
}

host.it("direct release confirms a lost executing turn before freeing waiting work", [approvedWork(["one"]), hostMissingTurns], function* (daemon) {
	yield* daemon.dispatch("one");
	const waiting = yield* daemon.reconcile("one");
	expect(waiting.step).toBe("waiting");
	expect(executing(waiting)).toBe(true);
	expect((yield* daemon.release(["one"]))[0]?.value.step).toBe("released");
	const released = yield* daemon.get("one");
	expect(executing(released)).toBe(false);
	expect(released.responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
	expect(daemon.missingTurnRequests()).not.toContain("turn/start");
});
