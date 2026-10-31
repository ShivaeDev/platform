import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { earlierBaseline, qualityConfigured, repositoryHas } from "#test/debtRecorded.ts";

const LEGACY_PATH = "quality/baseline.json";

baselineStory.it(
	"lint refuses a repository that still holds the earlier baseline and names the command that migrates it",
	[earlierBaseline()],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint");

		yield* outcomes({
			"error": [stderr(), expect.stringContaining("Run `quality baseline migrate --from quality/baseline.json`")],
			"exit": [outcome(), "invalid"],
		});
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline migrate turns the earlier baseline's measures into counts over the current limit, drops the fixed entry and lets lint pass",
	[earlierBaseline()],
	function* ({ lint, recorded, runs, stdout }) {
		expect(yield* recorded()).toBe("no baseline file");

		yield* runs("baseline", "migrate");

		yield* outcomes({
			"lint": [lint(), "passed"],
			"recorded debt": [recorded(), ["src/long.ts structure/max-lines 1", "src/longer.ts structure/max-lines 4"]],
			"report": [stdout(), "quality: moved 2 entries from quality/baseline.json to quality-baseline.jsonl, dropping 1 fixed entry.\n"],
		});
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline migrate refuses to overwrite an existing JSON Lines baseline",
	[qualityConfigured(), repositoryHas({ content: "", path: "quality-baseline.jsonl" }, { content: "{}", path: LEGACY_PATH })],
	function* ({ outcome, runs, stderr }) {
		yield* runs("baseline", "migrate");

		yield* outcomes({
			"error": [stderr(), "quality: quality-baseline.jsonl already exists. Migrate into a baseline file that does not exist yet.\n"],
			"exit": [outcome(), "invalid"],
		});
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline migrate without an earlier baseline is invalid and names the --from option",
	[qualityConfigured()],
	function* ({ outcome, runs, stderr }) {
		yield* runs("baseline", "migrate");

		yield* outcomes({
			"error": [stderr(), "quality: no baseline at quality/baseline.json to migrate. Name it with --from <file>.\n"],
			"exit": [outcome(), "invalid"],
		});
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline migrate refuses an earlier baseline with a negative count and names that count's path",
	[qualityConfigured(), repositoryHas({ content: '{"structure/max-lines":{"src/full.ts":{"count":-1}}}', path: LEGACY_PATH })],
	function* ({ outcome, runs, stderr }) {
		yield* runs("baseline", "migrate");

		yield* outcomes({
			"error": [stderr(), expect.stringMatching(/quality\/baseline\.json is invalid[\s\S]*structure\/max-lines\.src\/full\.ts\.count/u)],
			"exit": [outcome(), "invalid"],
		});
	},
	CLI_TIMEOUT,
);
