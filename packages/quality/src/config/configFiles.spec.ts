import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { builtInRules } from "#rules/builtIn.ts";
import { configFile, configLinksToMissingFile, configLoading } from "#test/configLoading.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";

const DEFAULT_SETTINGS = {
	baseline: "quality-baseline.jsonl",
	file: "quality.config.ts",
	registry: "quality/registry.json",
	root: "",
	sources: ["."],
};

for (const [repository, traits] of [
	["an empty quality.config.ts", [configFile("export default {};\n")]],
	["no config", []],
] as const) {
	configLoading.it(
		`quality loads ${repository} with the default baseline, registry and sources, and activates every built-in rule`,
		traits,
		function* ({ activeRules, loads, settings }) {
			yield* loads();

			yield* outcomes([
				["active rules", () => activeRules(), builtInRules.map((rule) => rule.id)],
				["settings", () => settings(), DEFAULT_SETTINGS],
			]);
		},
	);
}

configLoading.it(
	"quality takes the repository root from the folder of a config chosen by its path",
	[configFile("export default {};\n", "tools/quality.config.ts")],
	function* ({ loads, settings }) {
		yield* loads("tools/quality.config.ts");

		yield* assertThat(yield* settings(), (actual) => actual.toMatchObject({ file: "tools/quality.config.ts", root: "tools" }));
	},
);

configLoading.it(
	"quality refuses a config symlink to a missing file as unloadable instead of using the defaults",
	[configLinksToMissingFile()],
	function* ({ loads, outcome, problem }) {
		yield* loads();

		yield* withMatchers((expect) =>
			outcomes([
				["load", () => outcome(), "refused"],
				["problem", () => problem(), expect.stringMatching(/^cannot load quality\.config\.ts: /u)],
			]),
		);
	},
);

configLoading.it(
	"quality refuses a config without a default export and asks for defineConfig as the default",
	[configFile("export const config = {};\n")],
	function* ({ loads, problem }) {
		yield* loads();

		yield* assertThat(yield* problem(), (actual) =>
			actual.toBe("quality.config.ts has no default export. Export defineConfig({ ... }) as the default."),
		);
	},
);

configLoading.it(
	"quality refuses a config that throws while loading, keeping its error as the cause and out of the serialized failure",
	[configFile('throw new Error("config crashed");\n')],
	function* ({ loads, problemCause, serializedProblem }) {
		yield* loads();

		yield* withMatchers((expect) =>
			outcomes([
				["cause", () => problemCause(), "config crashed"],
				["serialized failure", () => serializedProblem(), expect.not.stringContaining('"cause"')],
			]),
		);
	},
);

configLoading.it(
	"quality refuses a config with an unknown setting and an unknown level and lists both problems",
	[configFile('export default { rules: { "structure/max-lines": "loud" }, sourcez: [] };\n')],
	function* ({ issues, loads }) {
		yield* loads();

		yield* assertThat(yield* issues(), (actual, expect) =>
			actual.toEqual([expect.stringMatching(/^sourcez: /u), expect.stringMatching(/^rules\.structure\/max-lines: /u)]),
		);
	},
);
