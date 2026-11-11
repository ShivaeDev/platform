import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { mixedDebt } from "#test/mixedDebt.ts";
import { committed, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const PREVIOUS = '{"path":"src/work.ts","rule":"effect/boundary","count":1}\n';
const RECORDED =
	'{"path":"src/other.ts","rule":"effect/boundary","count":1,"deep":0}\n{"path":"src/work.ts","rule":"biome/format","count":1}\n{"path":"src/work.ts","rule":"effect/boundary","count":1,"deep":0}\n{"path":"src/work.ts","rule":"nesting/max-depth","count":1}\n';
const UPGRADED = [mixedDebt, { content: "await Promise.resolve();\n", path: "src/other.ts" }, { content: PREVIOUS, path: "quality-baseline.jsonl" }];

repositoryStory.it(
	"after an upgrade, baseline write records every finding in untouched files and lets lint pass",
	[qualityInstalled(), repositoryHas(...UPGRADED), committed()],
	function* ({ outcome, reads, runs }) {
		yield* runs("baseline", "write");

		yield* outcomes([
			["write", () => outcome(), "passed"],
			["recorded debt", () => reads("quality-baseline.jsonl"), RECORDED],
		]);

		yield* runs("lint");

		yield* assertThat(yield* outcome(), (actual) => actual.toBe("passed"));
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"baseline write teaches repair and review with recorded rule counts and marks only rules absent from the previous baseline as new",
	[qualityInstalled(), repositoryHas(...UPGRADED), committed()],
	function* ({ runs, stdout }) {
		yield* runs("baseline", "write");

		yield* assertThat(yield* stdout(), (actual) =>
			actual.toContain(
				"First, fix every finding you can fix instead of recording it. Run `quality baseline tighten` after repairs.\n"
					+ "Then, for rules new since the previous baseline, review each recorded case and judge whether the rule reads the code correctly. Report any misread to Platform with the file, lines and what Quality would need instead of leaving it as debt.\n"
					+ "Recorded findings by rule:\n"
					+ "  biome/format: 1 finding (new since previous baseline)\n"
					+ "  effect/boundary: 2 findings\n"
					+ "  nesting/max-depth: 1 finding (new since previous baseline)\n",
			),
		);
	},
	CLI_TIMEOUT,
);

for (const { rules, recorded } of [
	{ recorded: `${PREVIOUS}{"path":"src/work.ts","rule":"nesting/max-depth","count":1}\n`, rules: ["nesting/max-depth"] },
	{ recorded: `{"path":"src/work.ts","rule":"biome/format","count":1}\n${PREVIOUS}`, rules: ["biome"] },
	{
		recorded: `{"path":"src/work.ts","rule":"biome/format","count":1}\n${PREVIOUS}{"path":"src/work.ts","rule":"nesting/max-depth","count":1}\n`,
		rules: ["biome", "nesting/max-depth"],
	},
]) {
	repositoryStory.it(
		`baseline write of ${rules.join(" and ")} records only the named rules in untouched files and preserves other debt`,
		[qualityInstalled(), repositoryHas(...UPGRADED), committed()],
		function* ({ outcome, reads, runs }) {
			yield* runs("baseline", "write", ...rules.flatMap((rule) => ["--rule", rule]));

			yield* outcomes([
				["write", () => outcome(), "passed"],
				["recorded debt", () => reads("quality-baseline.jsonl"), recorded],
			]);
		},
		CLI_TIMEOUT,
	);
}

repositoryStory.it(
	"the commit check rejects a newly flagged finding that was never written to the baseline",
	[qualityInstalled(), repositoryHas(...UPGRADED), committed()],
	function* ({ outcome, runs, stdout }) {
		yield* runs("hooks", "pre-commit");

		yield* withMatchers((expect) =>
			outcomes([
				["commit check", () => outcome(), "rejected"],
				["unwritten finding", () => stdout(), expect.stringContaining("nesting/max-depth")],
			]),
		);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"repeated writes still print repair guidance and counts without marking previously recorded rules as new",
	[qualityInstalled(), repositoryHas(...UPGRADED), committed()],
	function* ({ runs, stdout }) {
		yield* runs("baseline", "write");

		yield* runs("baseline", "write");

		yield* assertThat(yield* stdout(), (actual) =>
			actual.toMatch(
				/First, fix every finding you can fix instead of recording it\.[\s\S]*Recorded findings by rule:\n {2}biome\/format: 1 finding\n {2}effect\/boundary: 2 findings\n {2}nesting\/max-depth: 1 finding\n$/u,
			),
		);
	},
	CLI_TIMEOUT,
);
