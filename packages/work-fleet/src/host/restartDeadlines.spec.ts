import { expect } from "@effect/vitest";
import { Clock } from "effect";
import { fleetSupervisor, ignoresStop } from "#test/supervisorStory.ts";

fleetSupervisor.it(
	"restarts Board onto new TCP and socket code with a subscription and an unfinished request open",
	[],
	function* (fleet) {
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		const before = yield* fleet.state();
		if (before === undefined) {
			throw new Error("Expected running children");
		}
		const original = { directory: fleet.boardDir(), url: `http://127.0.0.1:${before.board.port}/` };
		expect(yield* fleet.serverInfo(before.board.port)).toEqual(original);
		expect(yield* fleet.socketServerInfo()).toContainEqual(expect.objectContaining({ exit: { _tag: "Success", value: original } }));
		const subscription = yield* fleet.subscribe(before.board.port);
		yield* fleet.holdBoardRequest();
		yield* fleet.changeBoardCode();
		yield* fleet.ready("board", before.board.pid);
		yield* subscription.closed;
		const after = yield* fleet.state();
		expect(after?.board.restarts).toBe(before.board.restarts + 1);
		expect(fleet.alive(before.board.pid ?? 0)).toBe(false);
		const replacement = { ...original, url: `${original.url}replacement` };
		expect(yield* fleet.serverInfo(before.board.port)).toEqual(replacement);
		expect(yield* fleet.socketServerInfo()).toContainEqual(expect.objectContaining({ exit: { _tag: "Success", value: replacement } }));
		expect(fleet.log()).not.toContain("force-killing");
	},
	90_000,
);

for (const name of ["daemon", "board"] as const) {
	fleetSupervisor.it(
		`force-kills an unresponsive ${name} while continuing to supervise its sibling`,
		[ignoresStop(name)],
		function* (fleet) {
			yield* fleet.start();
			yield* fleet.ready("daemon");
			yield* fleet.ready("board");
			const before = yield* fleet.state();
			if (before === undefined || before.daemon.pid === null || before.board.pid === null) {
				throw new Error("Expected running children");
			}
			const sibling = name === "daemon" ? "board" : "daemon";
			const started = yield* Clock.currentTimeMillis;
			if (name === "daemon") {
				yield* fleet.changeCode();
			} else {
				yield* fleet.changeBoardCode();
			}
			yield* fleet.waitForLog(`${name} ignored SIGTERM`);
			if (name === "board") {
				yield* fleet.ready("daemon", before.daemon.pid);
			}
			const siblingPid = (yield* fleet.state())?.[sibling].pid;
			if (siblingPid === undefined || siblingPid === null) {
				throw new Error("Expected a running sibling");
			}
			yield* fleet.crash(siblingPid);
			yield* fleet.ready(sibling, siblingPid);
			expect((yield* fleet.state())?.[name].pid).toBe(before[name].pid);
			expect(fleet.alive(before[name].pid ?? 0)).toBe(true);
			expect(fleet.log()).not.toContain("force-killing");
			yield* fleet.ready(name, before[name].pid);
			expect((yield* Clock.currentTimeMillis) - started).toBeGreaterThanOrEqual(30_000);
			expect(fleet.alive(before[name].pid ?? 0)).toBe(false);
			expect((yield* fleet.state())?.[name].restarts).toBe(before[name].restarts + 1);
			expect(fleet.log()).toContain(`${name} pid ${before[name].pid} did not stop within 30 seconds; force-killing`);
			yield* fleet.down();
			yield* fleet.exit();
			expect(fleet.lockExists()).toBe(false);
		},
		120_000,
	);
}
