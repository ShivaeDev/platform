import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { consumerRun, consumers } from "#package-check/test-support/consumers.ts";
import { packingGitConsumer } from "#package-check/test-support/packingGitConsumer.ts";

consumers.it(
	"leaves no Git packer writing when consumer cleanup begins",
	[packingGitConsumer],
	function* ({ check, remaining, writesAtCleanup }) {
		yield* outcomes([
			["consumer check", () => check(), undefined],
			["writes at cleanup", () => writesAtCleanup(), []],
			["remaining installs", () => remaining(), []],
		]);
	},
	30_000,
);

consumers.it(
	"removes each install before the next while keeping it alive for bin checks",
	[consumerRun()],
	function* ({ check, observations, remaining }) {
		yield* outcomes([
			["consumer check", () => check(), undefined],
			[
				"observations",
				() => observations(),
				[
					{ directories: 1, stage: "consumer" },
					{ directories: 1, stage: "bin" },
					{ directories: 1, stage: "scenario" },
				],
			],
			["remaining installs", () => remaining(), []],
		]);
	},
	30_000,
);

for (const stage of ["consumer", "bin", "scenario"] as const) {
	consumers.it(
		`removes the install when the ${stage} check fails`,
		[consumerRun(stage)],
		function* ({ check, observations, remaining }) {
			yield* outcomes([
				["consumer check", () => check(), expect.stringContaining(`${stage} defect`)],
				["last observation", () => Effect.map(observations(), (list) => list.at(-1)), { directories: 1, stage }],
				["remaining installs", () => remaining(), []],
			]);
		},
		30_000,
	);
}
