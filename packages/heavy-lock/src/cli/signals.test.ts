import { expect } from "vitest";
import { heldBy, lockStory } from "#test/kit.ts";

const live = { clock: "live", timeout: 20_000 } as const;

for (const [signal, code] of [
	["SIGINT", 10],
	["SIGTERM", 11],
	["SIGHUP", 12],
] as const) {
	lockStory.it(
		`forwarding ${signal} preserves the child's exit code and releases`,
		[],
		function* ({ cli, lock }) {
			const child = yield* cli.startTrapping();
			yield* cli.signal(child, signal);
			expect((yield* cli.exit(child)).status).toBe(code);
			expect(lock.contents()).toBeUndefined();
		},
		live,
	);
}

lockStory.it(
	"the command leads its own process group",
	[],
	function* ({ cli }) {
		expect(yield* cli.command(["/bin/sh", "-c", 'test "$(ps -o pgid= -p $$ | tr -d " ")" = "$$"'])).toEqual({ status: 0, stderr: "" });
	},
	live,
);

lockStory.it(
	"a command killed by a signal exits with the conventional code",
	[],
	function* ({ cli, lock }) {
		const child = yield* cli.startTrapping(false);
		yield* cli.signal(child, "SIGINT");
		expect((yield* cli.exit(child)).status).toBe(130);
		expect((yield* cli.command(["/bin/sh", "-c", "kill -KILL $$"])).status).toBe(137);
		expect(lock.contents()).toBeUndefined();
	},
	live,
);

lockStory.it(
	"a signal abandons a wait and preserves the holder's lock",
	[heldBy("build")],
	function* ({ cli, lock }) {
		const before = lock.contents();
		const waiter = yield* cli.startWaiting();
		yield* cli.signal(waiter, "SIGTERM");
		expect((yield* cli.exit(waiter)).status).toBe(143);
		expect(lock.contents()).toBe(before);
		expect(lock.files()).toEqual(["heavy-process.lock"]);
	},
	live,
);

for (const [description, fakePs, message] of [
	["ps cannot run", "", "Could not run ps to read this process's start time."],
	["ps returns no start time", "#!/bin/sh\nexit 0\n", "Could not read this process's start time from ps."],
] as const) {
	lockStory.it(
		`${description} fails before the command runs`,
		[],
		function* ({ cli, lock }) {
			expect(yield* cli.failsProcessLookup(fakePs)).toEqual({ ran: false, status: 1, stderr: `heavy-lock: ${message}\n` });
			expect(lock.contents()).toBeUndefined();
		},
		live,
	);
}
