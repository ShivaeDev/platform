import { assertThat, withMatchers } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "@shivaedev/test-kits/quality/adapters/cli.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { GROWN_DEBT, MIXED_DEBT } from "#test/firstAdoption.ts";
import { committed, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";

const RECORDED =
	'{"path":"src/work.ts","rule":"biome/format","count":1}\n{"path":"src/work.ts","rule":"effect/boundary","count":1}\n{"path":"src/work.ts","rule":"nesting/max-depth","count":1}\n';

repositoryStory.it(
	"first adoption records every rule kind in unchanged files and lets lint pass",
	[qualityInstalled(), repositoryHas(MIXED_DEBT), committed()],
	function* ({ outcome, reads, runs }) {
		yield* runs("baseline", "write", "--first-adoption");

		yield* outcomes([
			["adoption", () => outcome(), "passed"],
			["recorded debt", () => reads("quality-baseline.jsonl"), RECORDED],
		]);

		yield* runs("lint");

		yield* assertThat(yield* outcome(), (actual) => actual.toBe("passed"));
	},
	CLI_TIMEOUT,
);

for (const { rule, recorded } of [
	{
		recorded: '{"path":"src/work.ts","rule":"effect/boundary","count":1}\n{"path":"src/work.ts","rule":"nesting/max-depth","count":1}\n',
		rule: "nesting/max-depth",
	},
	{
		recorded: '{"path":"src/work.ts","rule":"biome/format","count":1}\n{"path":"src/work.ts","rule":"effect/boundary","count":1}\n',
		rule: "biome",
	},
]) {
	repositoryStory.it(
		`first adoption of ${rule} during an upgrade records only its findings and preserves other debt`,
		[
			qualityInstalled(),
			repositoryHas(MIXED_DEBT, {
				content: '{"path":"src/work.ts","rule":"effect/boundary","count":1}\n',
				path: "quality-baseline.jsonl",
			}),
			committed(),
		],
		function* ({ outcome, reads, runs }) {
			yield* runs("baseline", "write", "--first-adoption", "--rule", rule);

			yield* outcomes([
				["adoption", () => outcome(), "passed"],
				["recorded debt", () => reads("quality-baseline.jsonl"), recorded],
			]);
		},
		CLI_TIMEOUT,
	);
}

for (const selection of [[], ["--rule", "effect/boundary"], ["--first-adoption"]]) {
	repositoryStory.it(
		`after first adoption, a later write ${selection.join(" ") || "without options"} refuses new debt and preserves the baseline`,
		[qualityInstalled(), repositoryHas(MIXED_DEBT), committed()],
		function* ({ outcome, reads, runs, stderr, writes }) {
			yield* runs("baseline", "write", "--first-adoption");
			yield* assertThat(yield* reads("quality-baseline.jsonl"), (actual) => actual.toBe(RECORDED));
			yield* writes(GROWN_DEBT);

			yield* runs("baseline", "write", ...selection);

			yield* withMatchers((expect) =>
				outcomes([
					["exit", () => outcome(), "invalid"],
					["refusal", () => stderr(), expect.stringContaining("a baseline exists")],
					["recorded debt", () => reads("quality-baseline.jsonl"), RECORDED],
				]),
			);
		},
		CLI_TIMEOUT,
	);
}
