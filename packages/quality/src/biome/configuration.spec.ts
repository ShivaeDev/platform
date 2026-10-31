import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { malformedBiomeVcs, qualityLifecycle } from "#test/qualityLifecycle.ts";

for (const [setting, value] of [
	["VCS section that is not an object", false],
	["VCS root that is not a path", { root: 7 }],
] as const) {
	qualityLifecycle.it(
		`a Biome config with a ${setting} makes quality lint invalid and names the biome rule as failed`,
		[malformedBiomeVcs(value)],
		function* ({ outcome, runs, stderr }) {
			yield* runs("lint");

			yield* outcomes([
				["exit", () => outcome(), "invalid"],
				["rule failure", () => stderr(), expect.stringContaining("rule biome failed")],
			]);
		},
		CLI_TIMEOUT,
	);
}
