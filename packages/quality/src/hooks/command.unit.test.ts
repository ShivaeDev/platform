import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { hookCommand, shellWords } from "#hooks/command.ts";

const PRE_COMMIT = ["hooks", "pre-commit"];

describe("the hook's command", () => {
	it.effect.each([
		{
			ran: "a file in the repository, with its Node options",
			runs: { launcher: "tools/quality.ts", runner: ["node", "--conditions=@shivaedev/source"] },
			script: "/repo/tools/quality.ts",
		},
		{
			ran: "an installed package",
			runs: { launcher: "node_modules/.bin/quality", runner: [] },
			script: "/repo/node_modules/@shivaedev/quality/dist/cli.js",
		},
		{ ran: "a file outside the repository", runs: { launcher: "node_modules/.bin/quality", runner: [] }, script: "/cache/dlx/quality/dist/cli.js" },
	])("runs quality the way it ran from $ran", function* ({ runs, script }) {
		yield* assertThat(hookCommand("/repo", { options: ["--conditions=@shivaedev/source"], script }, undefined), (actual) =>
			actual.toEqual({ ...runs, args: PRE_COMMIT }),
		);
	});

	it.effect("passes a config file that is not quality.config.ts", function* () {
		yield* assertThat(hookCommand("/repo", { options: [], script: "/elsewhere/cli.js" }, "checks.config.ts").args, (actual) =>
			actual.toEqual([...PRE_COMMIT, "--config", "checks.config.ts"]),
		);
	});
});

describe("shell words", () => {
	it.effect("quote only the words the shell would split or expand", function* () {
		yield* assertThat(shellWords(["node", "--conditions=@shivaedev/source", "my tools/it's.ts", "$HOME"]), (actual) =>
			actual.toBe("node --conditions=@shivaedev/source 'my tools/it'\\''s.ts' '$HOME'"),
		);
	});
});
