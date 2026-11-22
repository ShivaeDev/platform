import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT_MS, heldBy, lockStory, psFails } from "#test/kit.ts";

for (const [signal, code] of [
	["SIGINT", 10],
	["SIGTERM", 11],
	["SIGHUP", 12],
] as const) {
	lockStory.it(
		`the CLI forwards ${signal} to check's descendant, which acknowledges the signal`,
		[],
		function* ({ cli }) {
			yield* cli.starts("check", cli.commands.withSignalAcknowledgingDescendant(signal));

			yield* cli.receives("check", signal);

			expect(yield* cli.standardOutputOf("check")).toBe(`running\ndescendant received ${signal}\n`);
		},
		CLI_TIMEOUT_MS,
	);

	lockStory.it(
		`the CLI forwards ${signal} to check's command, exits with the command's exit code ${code} and frees the lock`,
		[],
		function* ({ cli, lock }) {
			yield* cli.starts("check", cli.commands.trapsAndExits(signal, code));
			expect(yield* lock.holder()).toBe("check");

			yield* cli.receives("check", signal);

			yield* outcomes([
				["check's exit code", () => cli.exitCodeOf("check"), code],
				["lock holder", () => lock.holder(), "nobody"],
			]);
		},
		CLI_TIMEOUT_MS,
	);
}

lockStory.it(
	"when the forwarded SIGINT kills check's command, the CLI exits 130",
	[],
	function* ({ cli }) {
		yield* cli.starts("check", cli.commands.holdsUntilReleased);

		yield* cli.receives("check", "SIGINT");

		const exitCode = yield* cli.exitCodeOf("check");
		expect(exitCode).toBe(130);
	},
	CLI_TIMEOUT_MS,
);

lockStory.it(
	"when check's command kills itself with SIGKILL, the CLI exits 137",
	[],
	function* ({ cli }) {
		yield* cli.runs("check", cli.commands.killsItselfWith("SIGKILL"));

		const exitCode = yield* cli.exitCodeOf("check");
		expect(exitCode).toBe(137);
	},
	CLI_TIMEOUT_MS,
);

lockStory.it(
	"SIGTERM ends second's wait with exit 143 and leaves build's lock with no file of second's beside it",
	[heldBy("build")],
	function* ({ cli, lock }) {
		yield* cli.starts("second", cli.commands.exitsWith(0));
		expect(yield* cli.stateOf("second")).toBe("waiting");

		yield* cli.receives("second", "SIGTERM");

		yield* outcomes([
			["files beside the lock", () => lock.filesBesideLock(), ["heavy-process.lock"]],
			["lock holder", () => lock.holder(), "build"],
			["second's exit code", () => cli.exitCodeOf("second"), 143],
		]);
	},
	CLI_TIMEOUT_MS,
);

lockStory.it(
	"when ps is not on the PATH, the CLI runs check's command without the lock, exits with its exit code 3 and prints one notice line",
	[psFails("missing")],
	function* ({ cli }) {
		yield* cli.runs("check", cli.commands.exitsWith(3));

		yield* outcomes([
			["check ran its command", () => cli.ranItsCommand("check"), true],
			["check's exit code", () => cli.exitCodeOf("check"), 3],
			["printed by check", () => cli.printedBy("check"), ["heavy-process lock: ps is not on the PATH, so this command runs without the lock."]],
		]);
	},
	CLI_TIMEOUT_MS,
);

for (const [given, how] of [
	["ps prints no start time", "prints nothing"],
	["ps rejects -p like BusyBox ps", "rejects -p"],
] as const) {
	lockStory.it(
		`when ${given}, the CLI prints that this ps does not support \`ps -o lstart= -p <pid>\` and exits 1 without running check's command`,
		[psFails(how)],
		function* ({ cli }) {
			yield* cli.runs("check", cli.commands.exitsWith(0));

			yield* outcomes([
				["check ran its command", () => cli.ranItsCommand("check"), false],
				["check's exit code", () => cli.exitCodeOf("check"), 1],
				[
					"printed by check",
					() => cli.printedBy("check"),
					[
						`heavy-lock: Could not read this process's start time because this ps does not support \`ps -o lstart= -p <pid>\`, as BusyBox ps in Alpine images does not; install procps, or set CI to run the command without the lock.`,
					],
				],
			]);
		},
		CLI_TIMEOUT_MS,
	);
}
