import { describe, expect, it } from "vitest";
import { hookCommand, shellWords } from "#hooks/command.ts";

const PRE_COMMIT = ["hooks", "pre-commit"];

describe("the hook's command", () => {
	it.each([
		{
			ran: "a file in the repository, with its Node options",
			runs: { launcher: "tools/quality.ts", runner: ["node", "--conditions=source"] },
			script: "/repo/tools/quality.ts",
		},
		{
			ran: "an installed package",
			runs: { launcher: "node_modules/.bin/quality", runner: [] },
			script: "/repo/node_modules/@shivaedev/quality/dist/cli.js",
		},
		{ ran: "a file outside the repository", runs: { launcher: "node_modules/.bin/quality", runner: [] }, script: "/cache/dlx/quality/dist/cli.js" },
	])("runs quality the way it ran from $ran", ({ runs, script }) => {
		expect(hookCommand("/repo", { options: ["--conditions=source"], script }, undefined)).toEqual({ ...runs, args: PRE_COMMIT });
	});

	it("passes a config file that is not quality.config.ts", () => {
		expect(hookCommand("/repo", { options: [], script: "/elsewhere/cli.js" }, "checks.config.ts").args).toEqual([
			...PRE_COMMIT,
			"--config",
			"checks.config.ts",
		]);
	});
});

describe("shell words", () => {
	it("quote only the words the shell would split or expand", () => {
		expect(shellWords(["node", "--conditions=source", "my tools/it's.ts", "$HOME"])).toBe("node --conditions=source 'my tools/it'\\''s.ts' '$HOME'");
	});
});
