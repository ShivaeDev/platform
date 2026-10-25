import { expect } from "vitest";
import { consumerRun, consumers } from "#package-check/test-support/consumers.ts";

consumers.it(
	"removes each install before the next while keeping it alive for bin checks",
	[consumerRun()],
	function* ({ check, observations, remaining }) {
		expect(yield* check()).toBeUndefined();
		expect(yield* observations()).toEqual([
			{ directories: 1, stage: "consumer" },
			{ directories: 1, stage: "bin" },
			{ directories: 1, stage: "scenario" },
		]);
		expect(yield* remaining()).toEqual([]);
	},
	30_000,
);

for (const stage of ["consumer", "bin", "scenario"] as const) {
	consumers.it(
		`removes the install when the ${stage} check fails`,
		[consumerRun(stage)],
		function* ({ check, observations, remaining }) {
			expect(yield* check()).toContain(`${stage} defect`);
			expect((yield* observations()).at(-1)).toEqual({ directories: 1, stage });
			expect(yield* remaining()).toEqual([]);
		},
		30_000,
	);
}
