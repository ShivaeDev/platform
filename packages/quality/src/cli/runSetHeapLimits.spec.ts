import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heapLimitRun } from "#test/heapLimitRun.ts";

heapLimitRun.it(
	"the executable gives a lint of the fast rules 2048 MB and a run of every rule 3072 MB, reading the run set as the lint does",
	[],
	function* ({ limitFor }) {
		yield* outcomes([
			["quality", () => limitFor([]), 2048],
			["quality lint", () => limitFor(["lint"]), 2048],
			["quality lint --full", () => limitFor(["lint", "--full"]), 3072],
			["quality lint in CI", () => limitFor(["lint"], { "CI": "true" }), 3072],
			["quality lint in a cloud session", () => limitFor(["lint"], { "CLAUDE_CODE_REMOTE": "true" }), 3072],
			["quality lint --fast in CI", () => limitFor(["lint", "--fast"], { "CI": "true" }), 2048],
			["quality hooks pre-commit", () => limitFor(["hooks", "pre-commit"]), 2048],
			["quality hooks pre-commit in a cloud session", () => limitFor(["hooks", "pre-commit"], { "CLAUDE_CODE_REMOTE": "true" }), 3072],
			["quality fix", () => limitFor(["fix"]), 3072],
			["quality baseline write", () => limitFor(["baseline", "write"]), 3072],
		]);
	},
);
