import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";

repositoryStory.it(
	"first adoption records synchronous IO and each throwing guard call as effect/boundary debt",
	[
		qualityInstalled(),
		repositoryHas({
			content:
				'import { readFileSync } from "node:fs";\n\nfunction guard(value: unknown) { if (!value) { throw new Error("missing"); } }\nexport const work = readFileSync("file", "utf8");\nguard(work);\nguard(work);',
			path: "src/work.ts",
		}),
		biomeFormatted(),
	],
	function* ({ outcome, reads, runs, stdout }) {
		yield* runs("lint");
		expect(yield* stdout()).toContain("Uses synchronous IO (node:fs.readFileSync)");
		expect(yield* outcome()).toBe("rejected");

		yield* runs("baseline", "write", "--rule", "effect/boundary");

		yield* outcomes({
			"adoption": [outcome(), "passed"],
			"recorded debt": [reads("quality-baseline.jsonl"), '{"path":"src/work.ts","rule":"effect/boundary","count":4}\n'],
		});
		yield* runs("lint");
		expect(yield* outcome()).toBe("passed");
	},
	CLI_TIMEOUT,
);
