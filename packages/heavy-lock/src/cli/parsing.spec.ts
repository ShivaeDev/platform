import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveCli, lockStory } from "#test/kit.ts";

lockStory.it(
	"a command without flags can run without the -- separator",
	[],
	function* ({ cli }) {
		yield* cli.invokedWith("check", ["/bin/echo", "running"]);

		yield* outcomes({
			"exit code": [cli.exitCodeOf("check"), 0],
			"output": [cli.standardOutputOf("check"), "running\n"],
		});
	},
	liveCli,
);

for (const args of [[], ["--"]]) {
	lockStory.it(
		`heavy-lock ${args.join(" ")} without a command shows usage and exits 1`,
		[],
		function* ({ cli }) {
			yield* cli.invokedWith("check", args);

			yield* outcomes({
				"error": [cli.printedBy("check"), ["ERROR", "  Missing required argument: command"]],
				"exit code": [cli.exitCodeOf("check"), 1],
				"usage": [cli.standardOutputOf("check"), expect.stringContaining("heavy-lock [flags] <command> [<args...>]")],
			});
		},
		liveCli,
	);
}

lockStory.it(
	"an unknown flag shows usage, exits 1 and leaves the wrapped command unstarted",
	[],
	function* ({ cli }) {
		yield* cli.invokedWith("check", ["--unknown", "--", ...cli.commands.exitsWith(0)]);

		yield* outcomes({
			"command ran": [cli.ranItsCommand("check"), false],
			"error": [cli.printedBy("check"), ["ERROR", "  Unrecognized flag: --unknown in command heavy-lock"]],
			"exit code": [cli.exitCodeOf("check"), 1],
			"usage": [cli.standardOutputOf("check"), expect.stringContaining("heavy-lock [flags] <command> [<args...>]")],
		});
	},
	liveCli,
);

lockStory.it(
	"help shows usage and exits successfully without starting the wrapped command",
	[],
	function* ({ cli }) {
		yield* cli.invokedWith("check", ["--help", "--", ...cli.commands.exitsWith(3)]);

		yield* outcomes({
			"command ran": [cli.ranItsCommand("check"), false],
			"exit code": [cli.exitCodeOf("check"), 0],
			"usage": [cli.standardOutputOf("check"), expect.stringContaining("heavy-lock [flags] <command> [<args...>]")],
		});
	},
	liveCli,
);

lockStory.it(
	"arguments after -- reach the wrapped command unchanged, including help, unknown flags, empty arguments and spaces",
	[],
	function* ({ cli }) {
		yield* cli.runs("check", cli.commands.reportsArguments("--help", "--unknown", "", "two words", "--"));

		expect(yield* cli.standardOutputOf("check")).toBe("running\n--help\n--unknown\n\ntwo words\n--\n");
	},
	liveCli,
);
