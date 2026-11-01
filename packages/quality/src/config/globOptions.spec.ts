import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { exceptionStory, repositoryHas } from "#test/exceptionStory.ts";
import { config } from "#test/tree.ts";

const RULE_OPTIONS = [
	["files/named-after-export", "toolOwned", "src/"],
	["files/other-names", "toolOwned", "src/"],
	["files/folder-names", "toolOwned", "src/"],
	["files/other-names", "content", "src/"],
	["files/folder-names", "content", "src/"],
	["boundaries/http-status", "edge", "src/**"],
	["boundaries/auth-sql", "owners", "src/**"],
	["tests/follow", "suites", "src/"],
	["tests/colocated", "suites", "src/"],
] as const;

const SOURCE = { content: "export function value() { return 1; }\n", path: "src/value.ts" };

for (const [rule, option, glob] of RULE_OPTIONS) {
	for (const [failure, declaration, problem] of [
		["a missing reason", { glob }, "reason"],
		["a blank reason", { glob, reason: " " }, "a reason for this glob"],
		["a stale glob", { glob: "gone/**", reason: "The generator owns these names." }, '"gone/**" matches no current file'],
	] as const) {
		exceptionStory.it(
			`quality refuses ${rule} ${option} with ${failure}`,
			[repositoryHas(config(JSON.stringify({ rules: { [rule]: { options: { [option]: [declaration] } } }, sources: ["src"] })), SOURCE)],
			function* ({ outcome, runs, stderr }) {
				yield* runs("lint");

				yield* outcomes([
					["exit", () => outcome(), "invalid"],
					["problem", () => stderr(), expect.stringContaining(problem)],
				]);
			},
			CLI_TIMEOUT,
		);
	}
}

exceptionStory.it(
	"quality refuses an individually stale glob even when another declaration still matches",
	[
		repositoryHas(
			config(
				'{ rules: { "files/named-after-export": { options: { toolOwned: [{ glob: "src/", reason: "The generator owns these names." }, { glob: "gone/", reason: "A second generator owns these names." }] } } }, sources: ["src"] }',
			),
			SOURCE,
		),
	],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "invalid"],
			["problem", () => stderr(), expect.stringContaining('toolOwned.1.glob: "gone/" matches no current file')],
		]);
	},
	CLI_TIMEOUT,
);
