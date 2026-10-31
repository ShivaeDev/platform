import { expect } from "@effect/vitest";
import { Clock, Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fleetSupervisor, ignoresStop } from "#test/supervisorStory.ts";

fleetSupervisor.it(
	"a Board code change with a subscription and an unfinished request open restarts Board once onto the new TCP and socket code without force-killing it",
	[],
	function* (fleet) {
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		const before = yield* fleet.running();
		const original = { directory: fleet.boardDir(), url: `http://127.0.0.1:${before.board.port}/` };
		yield* outcomes([
			["TCP server", () => fleet.serverInfo(before.board.port), original],
			["socket server", () => fleet.socketServerInfo(), original],
		]);
		const subscription = yield* fleet.subscribe(before.board.port);
		yield* fleet.holdBoardRequest();

		yield* fleet.changeBoardCode();

		yield* fleet.ready("board", before.board.pid);
		yield* subscription.closed;
		const replacement = { ...original, url: `${original.url}replacement` };
		expect(fleet.alive(before.board.pid ?? 0)).toBe(false);
		yield* outcomes([
			["Board restarts", () => fleet.state().pipe(Effect.map((state) => state?.board.restarts)), before.board.restarts + 1],
			["TCP server", () => fleet.serverInfo(before.board.port), replacement],
			["socket server", () => fleet.socketServerInfo(), replacement],
		]);
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
			const before = yield* fleet.running();
			const sibling = name === "daemon" ? "board" : "daemon";
			const started = yield* Clock.currentTimeMillis;
			if (name === "daemon") {
				yield* fleet.changeCode();
			} else {
				yield* fleet.changeBoardCode();
			}
			yield* fleet.waitForLog(`${name} ignored SIGTERM`);
			const siblingPid = yield* fleet.runningPid(sibling);
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
