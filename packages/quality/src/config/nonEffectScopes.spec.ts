import { expect } from "@effect/vitest";
import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "@shivaedev/test-kits/quality/adapters/cli.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { nonEffectConfig, nonEffectFiles } from "#test/nonEffectFiles.ts";
import { qualityInstalled, repositoryHas, ruleStory } from "#test/ruleStory.ts";

const REPOSITORY = [qualityInstalled(), effectResolves(), repositoryHas(...nonEffectFiles)];

ruleStory.it(
	"declared non-Effect folders and their descendants have no Effect findings while other source and importers stay checked",
	[...REPOSITORY, repositoryHas(nonEffectConfig())],
	function* ({ gate, gateOutcome, gateReports }) {
		yield* gate();

		const report = yield* gateReports("effect/");
		expect(report).not.toMatch(/ {2}packages\/game\/src\/(?:simulation|engine)\//u);
		for (const rule of ["adapter-imports", "boundary", "failure-honesty", "service-ids", "service-parameters"]) {
			expect(report).toContain(`error effect/${rule}`);
		}
		expect(report).toContain("packages/game/src/importer.ts");
		expect(report).toContain("packages/game/src/simulationExtra/code.ts");
		expect(report).toContain("packages/game/src/ordinary/code.ts");
		yield* outcomes([
			["gate", () => gateOutcome(), "rejected"],
			["imported service", () => gateReports("effect/service-parameters"), expect.stringContaining("packages/game/src/importer.ts")],
		]);
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"non-Effect folders retain comment checks and Biome checks unrelated to Effect while Effect plugins still report outside",
	[...REPOSITORY, repositoryHas(nonEffectConfig())],
	function* ({ gate, gateReports }) {
		yield* gate();

		yield* assertThat(yield* gateReports("comments/no-todo"), (actual) => actual.toContain("packages/game/src/simulation/code.ts"));
		const biome = yield* gateReports("biome/");
		expect(biome).toContain("packages/game/src/simulation/code.ts");
		expect(biome).not.toMatch(
			/ {2}packages\/game\/src\/(?:simulation|engine)\/[^\n]+(?:Ambient time|Effect.fn|A schema|Schema.Struct field|service's Layer|test body)/u,
		);
		for (const message of [
			"Ambient time",
			"Effect.fn takes",
			"whole body is Effect.gen",
			"A schema",
			"Schema.Struct field",
			"service's Layer",
			"A test body",
		]) {
			expect(biome).toContain(message);
		}
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"dot-prefixed folders with a trailing slash scope Effect findings to their descendants",
	[...REPOSITORY, repositoryHas(nonEffectConfig(["./packages/game/src/simulation/"]))],
	function* ({ gate, gateReports }) {
		yield* gate();

		yield* assertThat(yield* gateReports("effect/"), (actual) => {
			actual.toContain("packages/game/src/engine/code.ts");
			actual.not.toMatch(/ {2}packages\/game\/src\/simulation\//u);
		});
	},
	CLI_TIMEOUT,
);

for (const folder of ["", "../simulation", "/simulation", "src/**", "."]) {
	ruleStory.it(
		`the gate refuses a non-Effect folder that is not an explicit repository folder: ${JSON.stringify(folder)}`,
		[...REPOSITORY, repositoryHas(nonEffectConfig([folder]))],
		function* ({ gate, gateOutcome, gateReport }) {
			yield* gate();

			yield* outcomes([
				["gate", () => gateOutcome(), "invalid"],
				["problem", () => gateReport(), expect.stringContaining("nonEffectFolders")],
			]);
		},
		CLI_TIMEOUT,
	);
}
