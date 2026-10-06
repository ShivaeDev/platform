import { describe, expect, it } from "vitest";
import { hookCommand, shellWords } from "#hooks/command.ts";

describe("hookCommand", () => {
	it.each([
		{
			launch: ["node", "--conditions=source", "tools/quality.ts"],
			ran: "a file in the repository, with its Node options",
			script: "/repo/tools/quality.ts",
		},
		{ launch: ["node_modules/.bin/quality"], ran: "an installed package", script: "/repo/node_modules/@shivaedev/quality/dist/cli.js" },
		{ launch: ["node_modules/.bin/quality"], ran: "a file outside the repository", script: "/cache/dlx/quality/dist/cli.js" },
	])("runs quality the way it ran from $ran", ({ launch, script }) => {
		expect(hookCommand("/repo", { options: ["--conditions=source"], script }, undefined)).toEqual([...launch, "hooks", "pre-commit"]);
	});

	it("passes a config file that is not quality.config.ts", () => {
		expect(hookCommand("/repo", { options: [], script: "/elsewhere/cli.js" }, "checks.config.ts")).toEqual([
			"node_modules/.bin/quality",
			"hooks",
			"pre-commit",
			"--config",
			"checks.config.ts",
		]);
	});
});

describe("shellWords", () => {
	it("quotes only the words the shell would split or expand", () => {
		expect(shellWords(["node", "--conditions=source", "my tools/it's.ts", "$HOME"])).toBe("node --conditions=source 'my tools/it'\\''s.ts' '$HOME'");
	});
});
