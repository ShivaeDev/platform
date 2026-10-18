import { expect } from "vitest";
import { heldBy, liveCli, lockStory, processLookupFails } from "#test/kit.ts";

for (const [signal, code] of [
	["SIGINT", 10],
	["SIGTERM", 11],
	["SIGHUP", 12],
] as const) {
	lockStory.it(
		`forwarding ${signal} preserves the child's exit code and releases`,
		[],
		function* ({ cli, lock }) {
			const child = yield* cli.start(cli.trappingCommand(signal, code));
			yield* cli.waitForReady();
			yield* cli.signal(child, signal);
			expect((yield* cli.exit(child)).status).toBe(code);
			expect(lock.contents()).toBeUndefined();
		},
		liveCli,
	);
}

lockStory.it(
	"the command leads its own process group",
	[],
	function* ({ cli }) {
		expect(yield* cli.command(["/bin/sh", "-c", 'test "$(ps -o pgid= -p $$ | tr -d " ")" = "$$"'])).toEqual({ status: 0, stderr: "" });
	},
	liveCli,
);

lockStory.it(
	"a command killed by a signal exits with the conventional code",
	[],
	function* ({ cli, lock }) {
		const child = yield* cli.start(cli.sleepingCommand);
		yield* cli.waitForReady();
		yield* cli.signal(child, "SIGINT");
		expect((yield* cli.exit(child)).status).toBe(130);
		expect((yield* cli.command(["/bin/sh", "-c", "kill -KILL $$"])).status).toBe(137);
		expect(lock.contents()).toBeUndefined();
	},
	liveCli,
);

lockStory.it(
	"a signal abandons a wait and preserves the holder's lock",
	[heldBy("build")],
	function* ({ cli, lock }) {
		const before = lock.contents();
		const waiter = yield* cli.start(["true"]);
		yield* cli.waitForWaiting(waiter);
		yield* cli.signal(waiter, "SIGTERM");
		expect((yield* cli.exit(waiter)).status).toBe(143);
		expect(lock.contents()).toBe(before);
		expect(lock.files()).toEqual(["heavy-process.lock"]);
	},
	liveCli,
);

for (const [description, mode, message] of [
	["ps cannot run", "missing", "Could not run ps to read this process's start time."],
	["ps returns no start time", "empty", "Could not read this process's start time from ps."],
] as const) {
	lockStory.it(
		`${description} fails before the command runs`,
		[processLookupFails(mode)],
		function* ({ cli, lock }) {
			expect(yield* cli.command(["/usr/bin/touch", cli.marker])).toEqual({ status: 1, stderr: `heavy-lock: ${message}\n` });
			expect(cli.markerExists()).toBe(false);
			expect(lock.contents()).toBeUndefined();
		},
		liveCli,
	);
}
