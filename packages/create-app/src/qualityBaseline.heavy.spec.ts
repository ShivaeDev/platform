import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { generated, installedPackageManager, linkedPackageScripts } from "#test/traits.ts";

application.it(
	"the starter passes the real Quality gate with an empty baseline",
	[],
	function* ({ lintStarter, scriptResult, starterFile }) {
		yield* lintStarter();

		yield* outcomes([
			["Quality gate", () => scriptResult(), "passed"],
			["starter baseline", () => starterFile("quality-baseline.jsonl"), ""],
		]);
	},
	120_000,
);

for (const flags of [[], ["--minimal"]] as const) {
	application.it(
		`the generated ${flags.length === 0 ? "full" : "minimal"} app passes the real Quality gate with an empty baseline`,
		[linkedPackageScripts, installedPackageManager, generated("my-app", ...flags)],
		function* ({ file, pnpm, scriptResult }) {
			yield* pnpm("lint");

			yield* outcomes([
				["Quality gate", () => scriptResult(), "passed"],
				["generated baseline", () => file("quality-baseline.jsonl"), ""],
			]);
		},
		120_000,
	);
}
