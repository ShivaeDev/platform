import { expect } from "@effect/vitest";
import * as HttpStatus from "effect/http/HttpStatus";
import { fleetSupervisor, slowLiveRequest, staleSupervisor } from "#test/supervisorStory.ts";

fleetSupervisor.it(
	"one command serves a consumer board and refuses another up or hand-started process",
	[],
	function* (fleet) {
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		const state = yield* fleet.state();
		expect(state).toBeDefined();
		if (state === undefined) {
			throw new Error("Expected supervision status");
		}
		const home = yield* fleet.request(state, "board", "/home.md");
		expect(home.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(home.body).toContain("<title>home.md</title>");
		expect((yield* fleet.navigation(state.board.port)).home?.file).toBe("home.md");
		expect((yield* fleet.inbox(state.board.port)).you).toEqual(expect.arrayContaining([expect.objectContaining({ id: "decision.operator" })]));
		const preview = yield* fleet.preview(state.board.port);
		expect((yield* fleet.register(state.board.port, preview.reviewedRevision)).question).toMatchObject({
			item: "decision.operator",
			request: "direction",
		});

		for (const result of [
			yield* fleet.cli(["up", fleet.boardDir()]),
			yield* fleet.cli(["serve", fleet.boardDir()]),
			yield* fleet.boardCli([fleet.boardDir()]),
		]) {
			expect(result.code).not.toBe(0);
			expect(`${result.stdout} ${result.stderr}`).toContain(`pid ${state.pid}`);
			expect(`${result.stdout} ${result.stderr}`).toContain(`Fleet port ${state.daemon.port}`);
			expect(`${result.stdout} ${result.stderr}`).toContain(`Board port ${state.board.port}`);
			expect(`${result.stdout} ${result.stderr}`).toContain(state.startedAt);
		}
		const status = yield* fleet.cli(["up", fleet.boardDir(), "--status"]);
		expect(status.code).toBe(0);
		expect(fleet.log()).toContain("Building the Work Board browser app");
		for (const value of [
			String(state.daemon.pid),
			String(state.board.pid),
			state.daemon.revision,
			state.board.revision,
			state.log,
			"uptime",
			"restarts 0",
		]) {
			expect(status.stdout).toContain(value);
		}
	},
	60_000,
);

fleetSupervisor.it(
	"takes over a lease left by a dead process",
	[staleSupervisor],
	function* (fleet) {
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		const status = yield* fleet.cli(["up", fleet.boardDir(), "--status", "--json"]);
		expect(status.code).toBe(0);
		const state = JSON.parse(status.stdout);
		expect(state.pid).not.toBe(fleet.stalePid());
		expect(fleet.alive(state.pid)).toBe(true);
	},
	60_000,
);

for (const name of ["daemon", "board"] as const) {
	fleetSupervisor.it(
		`restarts a crashed ${name} without restarting its sibling`,
		[],
		function* (fleet) {
			yield* fleet.start();
			yield* fleet.ready("daemon");
			yield* fleet.ready("board");
			const before = yield* fleet.state();
			if (before === undefined || before[name].pid === null) {
				throw new Error("Expected a running child");
			}
			yield* fleet.crash(before[name].pid);
			yield* fleet.ready(name, before[name].pid);
			const after = yield* fleet.state();
			expect(after?.[name]).toMatchObject({ restarts: 1, revision: before[name].revision });
			expect(after?.[name].pid).not.toBe(before[name].pid);
			const sibling = name === "daemon" ? "board" : "daemon";
			expect(after?.[sibling]).toEqual(before[sibling]);
			expect(fleet.log()).toContain(`${name} exited unexpectedly: Process interrupted due to receipt of signal: 'SIGKILL'`);
		},
		60_000,
	);
}

fleetSupervisor.it(
	"finishes an in-flight request before restarting onto changed installed code",
	[slowLiveRequest],
	function* (fleet) {
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		const before = yield* fleet.state();
		if (before === undefined) {
			throw new Error("Expected running supervision");
		}
		yield* fleet.beginRequest();
		yield* fleet.changeCode();
		expect((yield* fleet.finishRequest()).status).toBe(HttpStatus.fromLiteral("NoContent"));
		yield* fleet.awaitRevision(before.daemon.revision);
		const after = yield* fleet.state();
		if (after === undefined) {
			throw new Error("Expected replacement supervision");
		}
		expect(after.daemon.pid).not.toBe(before.daemon.pid);
		expect(after.daemon.restarts).toBe(before.daemon.restarts + 1);
		expect(after.board).toEqual(before.board);
		const response = yield* fleet.request(after, "daemon");
		expect(response.status).toBe(HttpStatus.fromLiteral("Created"));
		expect(fleet.log()).toContain(`code changed to ${after.daemon.revision}`);
	},
	60_000,
);

fleetSupervisor.it(
	"follows an upgraded package symlink onto the replacement code",
	[],
	function* (fleet) {
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		const before = yield* fleet.state();
		if (before === undefined) {
			throw new Error("Expected running supervision");
		}
		yield* fleet.upgrade();
		yield* fleet.awaitRevision(before.daemon.revision);
		const after = yield* fleet.state();
		if (after === undefined) {
			throw new Error("Expected replacement supervision");
		}
		expect(after.daemon.pid).not.toBe(before.daemon.pid);
		expect(after.daemon.restarts).toBe(before.daemon.restarts + 1);
		expect(after.board).toEqual(before.board);
		expect((yield* fleet.request(after, "daemon")).status).toBe(HttpStatus.fromLiteral("Created"));
	},
	60_000,
);

fleetSupervisor.it(
	"down stops both processes and releases the board for another up",
	[],
	function* (fleet) {
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		const before = yield* fleet.state();
		if (before === undefined || before.daemon.pid === null || before.board.pid === null) {
			throw new Error("Expected both child pids");
		}
		const subscription = yield* fleet.subscribe(before.board.port);
		const stopped = yield* fleet.down();
		yield* subscription.closed;
		expect(stopped.code).toBe(0);
		yield* fleet.exit();
		expect(fleet.alive(before.daemon.pid)).toBe(false);
		expect(fleet.alive(before.board.pid)).toBe(false);
		expect(fleet.lockExists()).toBe(false);
		expect(yield* fleet.state()).toBeUndefined();
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		expect((yield* fleet.state())?.pid).not.toBe(before.pid);
	},
	60_000,
);
