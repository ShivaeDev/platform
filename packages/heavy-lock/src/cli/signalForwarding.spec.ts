import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heldBy, liveCli, lockStory, psFails } from "#test/kit.ts";

for (const [signal, code] of [
	["SIGINT", 10],
	["SIGTERM", 11],
	["SIGHUP", 12],
] as const) {
	lockStory.it(
		`the CLI forwards ${signal} to check's command, exits with the command's exit code ${code} and frees the lock`,
		[],
		function* ({ cli, lock }) {
			yield* cli.starts("check", cli.commands.trapsAndExits(signal, code));
			expect(yield* lock.holder()).toBe("check");

			yield* cli.receives("check", signal);

			yield* outcomes({
				"check's exit code": [cli.exitCodeOf("check"), code],
				"lock holder": [lock.holder(), "nobody"],
			});
		},
		liveCli,
	);
}

lockStory.it(
	"when the forwarded SIGINT kills check's command, the CLI exits 130",
	[],
	function* ({ cli }) {
		yield* cli.starts("check", cli.commands.sleeps);

		yield* cli.receives("check", "SIGINT");

		const exitCode = yield* cli.exitCodeOf("check");
		expect(exitCode).toBe(130);
	},
	liveCli,
);

lockStory.it(
	"when check's command kills itself with SIGKILL, the CLI exits 137",
	[],
	function* ({ cli }) {
		yield* cli.runs("check", cli.commands.killsItselfWith("SIGKILL"));

		const exitCode = yield* cli.exitCodeOf("check");
		expect(exitCode).toBe(137);
	},
	liveCli,
);

lockStory.it(
	"SIGTERM ends second's wait with exit 143 and leaves build's lock with no file of second's beside it",
	[heldBy("build")],
	function* ({ cli, lock }) {
		yield* cli.starts("second", cli.commands.exitsWith(0));
		expect(yield* cli.stateOf("second")).toBe("waiting");

		yield* cli.receives("second", "SIGTERM");

		yield* outcomes({
			"files beside the lock": [lock.filesBesideLock(), ["heavy-process.lock"]],
			"lock holder": [lock.holder(), "build"],
			"second's exit code": [cli.exitCodeOf("second"), 143],
		});
	},
	liveCli,
);

for (const [how, message] of [
	["missing", "Could not run ps to read this process's start time."],
	["prints nothing", "Could not read this process's start time from ps."],
] as const) {
	lockStory.it(
		`when ps is ${how === "missing" ? "not on the PATH" : "printing no start time"}, the CLI prints "${message}" and exits 1 without running check's command`,
		[psFails(how)],
		function* ({ cli }) {
			yield* cli.runs("check", cli.commands.exitsWith(0));

			yield* outcomes({
				"check ran its command": [cli.ranItsCommand("check"), false],
				"check's exit code": [cli.exitCodeOf("check"), 1],
				"printed by check": [cli.printedBy("check"), [`heavy-lock: ${message}`]],
			});
		},
		liveCli,
	);
}
