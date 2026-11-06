import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeFormatted, exceptionStory, repositoryHas, repositoryTracks } from "#test/exceptionStory.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";
import { config } from "#testing/adapters/tree.ts";

const ANY = "biome/lint/suspicious/noExplicitAny";
const REASON = "The external format requires it.";

for (const [type, result] of [
	["any", "passed"],
	["unknown", "rejected"],
] as const) {
	exceptionStory.it(
		`quality lint ${result === "passed" ? "keeps an active" : "rejects a stale"} Biome exception for a gitignored tracked file`,
		[
			repositoryHas(
				config(JSON.stringify({ exceptions: [{ files: ["src/parse.ts"], reason: REASON, rules: [ANY] }], sources: ["src"] })),
				{ content: `export function parse(text: string): ${type} {\n\treturn JSON.parse(text);\n}\n`, path: "src/parse.ts" },
				{ content: "node_modules/\nsrc/\n", path: ".gitignore" },
			),
			repositoryTracks("src/parse.ts"),
			biomeFormatted(),
		],
		function* ({ outcome, runs, stdout }) {
			yield* runs("lint");

			yield* assertThat(yield* outcome(), (actual) => actual.toBe(result));
			if (result === "rejected") {
				yield* assertThat(yield* stdout(), (actual) => actual.toContain(`${ANY} src/parse.ts matches no finding.`));
			}
		},
		CLI_TIMEOUT,
	);
}

exceptionStory.it(
	"quality lint rejects a Biome exception whose only matching diagnostic Quality already recognizes as a generator test parameter",
	[
		repositoryHas(
			config(
				JSON.stringify({
					exceptions: [{ files: ["src/engine.test.ts"], reason: REASON, rules: ["biome/lint/style/noDoneCallback"] }],
					sources: ["src"],
				}),
			),
			{
				content:
					'import { makeEffectIt } from "./entry.ts"; const it = makeEffectIt();\nit("reads the engine", function* (engine) { yield engine; });\n',
				path: "src/engine.test.ts",
			},
		),
		biomeFormatted(),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "rejected"],
				["stale pair", () => stdout(), expect.stringContaining("biome/lint/style/noDoneCallback src/engine.test.ts matches no finding.")],
			]),
		);
	},
	CLI_TIMEOUT,
);
