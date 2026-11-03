import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeFormatted, committed, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

repositoryStory.it(
	"first adoption records synchronous IO and each throwing guard call as effect/boundary debt",
	[
		qualityInstalled(),
		repositoryHas({
			content:
				'import { readFileSync } from "node:fs";\n\nfunction guard(value: unknown) { if (!value) { throw new Error("missing"); } }\nexport const work = readFileSync("file", "utf8");\nguard(work);\nguard(work);',
			path: "src/work.ts",
		}),
		repositoryHas({
			content: '{"path":"src/work.ts","rule":"effect/adapter-imports","count":1}\n{"path":"src/work.ts","rule":"effect/boundary","count":1}\n',
			path: "quality-baseline.jsonl",
		}),
		biomeFormatted(),
		committed(),
	],
	function* ({ outcome, reads, runs, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["finding", () => stdout(), expect.stringContaining("Uses synchronous IO (node:fs.readFileSync)")],
				["gate", () => outcome(), "rejected"],
			]),
		);

		yield* runs("baseline", "write", "--rule", "effect/boundary", "--first-adoption");

		yield* outcomes([
			["adoption", () => outcome(), "passed"],
			[
				"recorded debt",
				() => reads("quality-baseline.jsonl"),
				'{"path":"src/work.ts","rule":"effect/adapter-imports","count":1}\n{"path":"src/work.ts","rule":"effect/boundary","count":4}\n',
			],
		]);

		yield* runs("lint");

		yield* assertThat(yield* outcome(), (actual) => actual.toBe("passed"));
	},
	CLI_TIMEOUT,
);

for (const rules of [[], ["--rule", "structure/max-lines"]]) {
	repositoryStory.it(
		`first adoption refuses ${rules.length === 0 ? "an unnamed rule" : "a rule that permits exceptions"}`,
		[qualityInstalled(), repositoryHas({ content: "export const work = 1;\n", path: "src/work.ts" })],
		function* ({ outcome, runs, stderr }) {
			yield* runs("baseline", "write", "--first-adoption", ...rules);

			yield* withMatchers((expect) =>
				outcomes([
					["exit", () => outcome(), "invalid"],
					["reason", () => stderr(), expect.stringContaining("--first-adoption requires explicit --rule ids that refuse config exceptions")],
				]),
			);
		},
		CLI_TIMEOUT,
	);
}
