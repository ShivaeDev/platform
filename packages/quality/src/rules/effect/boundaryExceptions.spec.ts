import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { qualityInstalled, repositoryHas as repositoryContains, repositoryStory } from "#test/repositoryStory.ts";

for (const rule of ["effect/boundary", "effect/service-parameters"]) {
	repositoryStory.it(
		`quality lint refuses a config exception for ${rule}, which takes no exceptions`,
		[
			qualityInstalled(),
			repositoryContains(
				{ content: "export const value = 1;\n", path: "src/value.ts" },
				{
					content: `export default { exceptions: [{ files: ["src/value.ts"], reason: "An old bridge.", rules: ["${rule}"] }] };\n`,
					path: "quality.config.ts",
				},
			),
		],
		function* ({ outcome, runs, stdout }) {
			yield* runs("lint");

			yield* outcomes({
				"exit": [outcome(), "rejected"],
				"report": [stdout(), expect.stringContaining(`${rule} src/value.ts names a rule that takes no exceptions`)],
			});
		},
		CLI_TIMEOUT,
	);
}

repositoryStory.it(
	"quality lint still reports the effect/boundary finding that a refused config exception names",
	[
		qualityInstalled(),
		repositoryContains(
			{ content: "export const BRIDGE = async () => 1;\n", path: "src/bridge.ts" },
			{
				content: 'export default { exceptions: [{ files: ["src/bridge.ts"], reason: "An old bridge.", rules: ["effect/boundary"] }] };\n',
				path: "quality.config.ts",
			},
		),
	],
	function* ({ runs, stdout }) {
		yield* runs("lint");

		expect(yield* stdout()).toContain("src/bridge.ts:1  Uses async arrow.");
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint keeps the ambient time, randomness, console and process.env bans inside an adapters/ folder",
	[
		qualityInstalled(),
		repositoryContains({
			content: 'export function ambient() {\n\tconsole.log(Date.now(), Math.random(), process.env["MODE"]);\n}\n',
			path: "src/adapters/ambient.ts",
		}),
	],
	function* ({ runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"console": [stdout(), expect.stringContaining("console.* is banned")],
			"process.env": [stdout(), expect.stringContaining("process.env is banned")],
			"randomness": [stdout(), expect.stringContaining("Ambient randomness is banned")],
			"time": [stdout(), expect.stringContaining("Ambient time is banned")],
		});
	},
	CLI_TIMEOUT,
);
