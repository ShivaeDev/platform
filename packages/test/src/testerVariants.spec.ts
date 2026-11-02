import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { vitestRun } from "#test/vitestRun.ts";

const names = ["fixture generator", "fixture Effect", "it.effect generator", "it.effect Effect", "it.live generator", "it.live Effect"];

for (const variant of ["default", "fails", "only", "runIf", "skipIf"] as const) {
	vitestRun.it(
		`the ${variant} variant executes both body forms on fixture, effect and live testers`,
		[],
		function* ({ bodyOutcomes, lifecycle, runsVariant }) {
			yield* runsVariant(variant);

			yield* outcomes([
				["body outcomes", () => bodyOutcomes(), names.map((name) => ({ name, state: "passed" as const }))],
				[
					"executed bodies",
					() => lifecycle(),
					[
						"fixture ran its generator body",
						"fixture ran its Effect body",
						"it.effect ran its generator body",
						"it.effect ran its Effect body",
						"it.live ran its generator body",
						"it.live ran its Effect body",
					],
				],
			]);
		},
	);
}

for (const variant of ["skip", "runIf(false)", "skipIf(true)"] as const) {
	vitestRun.it(
		`the ${variant} variant skips both body forms on fixture, effect and live testers`,
		[],
		function* ({ bodyOutcomes, lifecycle, runsVariant }) {
			yield* runsVariant(variant);

			yield* outcomes([
				["body outcomes", () => bodyOutcomes(), names.map((name) => ({ name, state: "skipped" as const }))],
				["executed bodies", () => lifecycle(), []],
			]);
		},
	);
}
