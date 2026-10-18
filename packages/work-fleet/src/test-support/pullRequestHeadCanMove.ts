import { Effect } from "effect";
import type { WorkResult } from "#policy.ts";
import { engineScenario } from "#test/engineScenario.ts";

export function pullRequestHeadCanMove() {
	return engineScenario("the reported pull request can move while review runs", () => {
		let result: WorkResult = { head: "first-head", kind: "change", paths: ["src/one.ts"], pr: "https://example.invalid/pr/one" };
		return {
			context: {
				get result() {
					return result;
				},
				set result(value: typeof result) {
					result = value;
				},
			},
			options: { resultQuery: () => Effect.succeed(result), reviewRunning: true },
		};
	});
}
