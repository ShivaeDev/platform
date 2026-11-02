import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { biomeFormatted, committed, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";

repositoryStory.it(
	"adoption records outside imports in one row per file and tightening removes repaired import debt",
	[qualityInstalled(), repositoryHas({ content: 'import "node:fs";\nimport "node:path";\n', path: "src/work.ts" }), biomeFormatted(), committed()],
	function* ({ outcome, reads, runs, stdout, writes }) {
		yield* runs("lint");
		yield* outcomes([
			["gate", () => outcome(), "rejected"],
			["import finding", () => stdout(), expect.stringContaining('src/work.ts:1  Imports outside library "node:fs"')],
		]);

		yield* runs("baseline", "write", "--first-adoption", "--rule", "effect/adapter-imports");
		yield* outcomes([
			["adoption", () => outcome(), "passed"],
			["debt", () => reads("quality-baseline.jsonl"), '{"path":"src/work.ts","rule":"effect/adapter-imports","count":2}\n'],
		]);

		yield* runs("lint");
		expect(yield* outcome()).toBe("passed");

		yield* writes({ content: "export const work = 1;\n", path: "src/work.ts" });
		yield* runs("baseline", "tighten");
		yield* outcomes([
			["tightening", () => outcome(), "passed"],
			["repaired debt", () => reads("quality-baseline.jsonl"), undefined],
		]);
	},
	CLI_TIMEOUT,
);
