import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ci, heldBy, inheritsHolderIdOf, liveCli, locale, lockStory, workingDirectory } from "#test/kit.ts";

lockStory.it(
	"the CLI gives check's command the holder id it recorded in the lock for check",
	[],
	function* ({ cli }) {
		yield* cli.runs("check", cli.commands.reportsHolderId);

		expect(yield* cli.holderIdGivenTo("check")).toBe("check's holder id");
	},
	liveCli,
);

lockStory.it(
	"the CLI exits with its command's exit code 3",
	[],
	function* ({ cli }) {
		yield* cli.runs("check", cli.commands.exitsWith(3));

		const exitCode = yield* cli.exitCodeOf("check");
		expect(exitCode).toBe(3);
	},
	liveCli,
);

lockStory.it(
	"on a free lock, the CLI prints nothing of its own",
	[],
	function* ({ cli }) {
		yield* cli.runs("check", cli.commands.exitsWith(0));

		expect(yield* cli.printedBy("check")).toEqual([]);
	},
	liveCli,
);

lockStory.it(
	"the CLI passes what check's command prints to stderr through as its own",
	[],
	function* ({ cli }) {
		yield* cli.runs("check", cli.commands.printsToStderr("compiling"));

		expect(yield* cli.printedBy("check")).toEqual(["compiling"]);
	},
	liveCli,
);

lockStory.it(
	"check's command leads its own process group",
	[],
	function* ({ cli }) {
		yield* cli.runs("check", cli.commands.reportsProcessGroup);

		expect(yield* cli.ledItsProcessGroup("check")).toBe(true);
	},
	liveCli,
);

lockStory.it(
	"when check's command exits, the CLI frees the lock it held for check",
	[],
	function* ({ cli, lock }) {
		yield* cli.starts("check", cli.commands.holdsUntilReleased);
		expect(yield* lock.holder()).toBe("check");

		yield* cli.releases("check");

		expect(yield* lock.holder()).toBe("nobody");
	},
	liveCli,
);

lockStory.it(
	"a heavy-lock run nested in outer's command runs at once and gives its command outer's holder id",
	[],
	function* ({ cli }) {
		yield* cli.runs("outer", cli.commands.nestedRunOf(cli.commands.reportsHolderId));

		expect(yield* cli.holderIdGivenTo("outer")).toBe("outer's holder id");
	},
	liveCli,
);

lockStory.it(
	"second waits while first holds the lock, names first's pid and command, and once first's command exits runs its own and prints how long it waited",
	[],
	function* ({ cli }) {
		yield* cli.starts("first", cli.commands.holdsUntilReleased);
		yield* cli.starts("second", cli.commands.exitsWith(0));
		expect(yield* cli.stateOf("second")).toBe("waiting");
		const first = yield* cli.pidOf("first");

		yield* cli.releases("first");

		yield* outcomes({
			"printed by second": [
				cli.printedBy("second"),
				[
					expect.stringContaining(`waiting for pid ${first} running \`${cli.commands.holdsUntilReleased.join(" ")}\``),
					expect.stringMatching(/^heavy-process lock: acquired after \d+s$/u),
				],
			],
			"second ran its command": [cli.ranItsCommand("second"), true],
		});
	},
	liveCli,
);

lockStory.it(
	"under a German locale, the CLI records check's pid, C-locale start time, command and directory in the lock",
	[locale("de_DE.UTF-8"), workingDirectory("/")],
	function* ({ cli, protocol }) {
		yield* cli.starts("check", cli.commands.holdsUntilReleased);

		expect(yield* protocol.recordedHolder()).toEqual({
			command: cli.commands.holdsUntilReleased.join(" "),
			cwd: "/",
			id: expect.any(String),
			pid: yield* cli.pidOf("check"),
			processStartedAt: yield* cli.startTimeOf("check"),
			startedAtMs: expect.any(Number),
		});
	},
	liveCli,
);

lockStory.it(
	"with CI \"true\", the CLI runs check's command at once beside typecheck's lock, without a holder id",
	[heldBy("typecheck"), ci("true")],
	function* ({ cli, lock }) {
		yield* cli.runs("check", cli.commands.reportsHolderId);

		yield* outcomes({
			"check's holder id": [cli.holderIdGivenTo("check"), "no holder id"],
			"lock holder": [lock.holder(), "typecheck"],
		});
	},
	liveCli,
);

lockStory.it(
	'with CI "true", the CLI passes on the holder id check inherited from build',
	[heldBy("build"), inheritsHolderIdOf("build"), ci("true")],
	function* ({ cli }) {
		yield* cli.runs("check", cli.commands.reportsHolderId);

		expect(yield* cli.holderIdGivenTo("check")).toBe("build's holder id");
	},
	liveCli,
);

for (const args of [[], ["sleep", "1"], ["--"]]) {
	lockStory.it(
		`the CLI invoked as heavy-lock ${args.join(" ")} prints its usage and exits 2`,
		[],
		function* ({ cli }) {
			yield* cli.invokedWith("check", args);

			yield* outcomes({
				"check's exit code": [cli.exitCodeOf("check"), 2],
				"printed by check": [cli.printedBy("check"), ["Usage: heavy-lock -- <command> [args...]"]],
			});
		},
		liveCli,
	);
}

lockStory.it(
	"a command that cannot start makes the CLI print why and exit 127",
	[],
	function* ({ cli }) {
		yield* cli.runs("check", ["no-such-command-anywhere"]);

		yield* outcomes({
			"check's exit code": [cli.exitCodeOf("check"), 127],
			"printed by check": [cli.printedBy("check"), [expect.stringMatching(/^no-such-command-anywhere: /u)]],
		});
	},
	liveCli,
);
