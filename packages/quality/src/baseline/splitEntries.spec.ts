import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeFormatted, committed, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const FAIL = { content: 'export function fail(): never {\n\tthrow new Error("failed");\n}\n', path: "src/fail.ts" };

const UNSPLIT = [
	'{"path":"src/fail.ts","rule":"effect/boundary","count":1}',
	'{"path":"src/over.ts","rule":"effect/boundary","count":1}',
	'{"path":"src/work.ts","rule":"effect/boundary","count":2}',
	"",
].join("\n");

repositoryStory.it(
	"on a clean checkout, baseline prune records the deep share of every entry its file still fits and leaves an entry its file outgrew alone, while tighten changes nothing",
	[
		qualityInstalled(),
		repositoryHas(
			FAIL,
			{ content: "await Promise.resolve();\nawait Promise.resolve();\n", path: "src/over.ts" },
			{
				content: 'import { fail } from "./fail.ts";\n\nawait Promise.resolve();\n\nexport function stop() {\n\treturn fail();\n}\n',
				path: "src/work.ts",
			},
			{ content: UNSPLIT, path: "quality-baseline.jsonl" },
		),
		biomeFormatted(),
		committed(),
	],
	function* ({ reads, runs }) {
		yield* runs("baseline", "tighten");
		yield* assertThat(yield* reads("quality-baseline.jsonl"), (actual) => actual.toBe(UNSPLIT));

		yield* runs("baseline", "prune");

		yield* outcomes([
			[
				"after prune",
				() => reads("quality-baseline.jsonl"),
				[
					'{"path":"src/fail.ts","rule":"effect/boundary","count":1,"deep":0}',
					'{"path":"src/over.ts","rule":"effect/boundary","count":1}',
					'{"path":"src/work.ts","rule":"effect/boundary","count":2,"deep":1}',
					"",
				].join("\n"),
			],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"baseline tighten says when a file's typed half now reports more than its entry allows, and lowers the fast share it fixed",
	[
		qualityInstalled(),
		repositoryHas(
			FAIL,
			{ content: 'await Promise.resolve();\nthrow new Error("refused");\n', path: "src/move.ts" },
			{
				content:
					'{"path":"src/fail.ts","rule":"effect/boundary","count":1,"deep":0}\n{"path":"src/move.ts","rule":"effect/boundary","count":2,"deep":0}\n',
				path: "quality-baseline.jsonl",
			},
		),
		biomeFormatted(),
		committed(),
	],
	function* ({ reads, runs, stdout, writes }) {
		yield* writes({ content: 'import { fail } from "./fail.ts";\n\nawait Promise.resolve();\nfail();\n', path: "src/move.ts" });
		yield* runs("baseline", "tighten");

		yield* withMatchers((expect) =>
			outcomes([
				[
					"message",
					() => stdout(),
					expect.stringContaining(
						"quality: effect/boundary's typed half reports 1 finding more in src/move.ts than its entry allows; CI will report it.",
					),
				],
				[
					"entry",
					() => reads("quality-baseline.jsonl"),
					expect.stringContaining('{"path":"src/move.ts","rule":"effect/boundary","count":1,"deep":0}'),
				],
			]),
		);
	},
	CLI_TIMEOUT,
);
