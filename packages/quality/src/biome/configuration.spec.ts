import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { malformedBiomeVcs, qualityLifecycle } from "#test/qualityLifecycle.ts";

for (const [setting, value] of [
	["VCS section", false],
	["VCS root", { root: 7 }],
] as const) {
	qualityLifecycle.it(
		`a malformed Biome ${setting} aborts the run with its rule id`,
		[malformedBiomeVcs(value)],
		function* ({ check, status, stderr }) {
			yield* check();

			yield* outcomes({
				"exit status": [Effect.sync(status), 2],
				"rule failure": [Effect.sync(stderr), expect.stringContaining("rule biome failed")],
			});
		},
	);
}
