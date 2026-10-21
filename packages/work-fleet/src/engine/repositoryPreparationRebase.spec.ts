import { expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import { mainMovedPastPreparation } from "#test/mainMovedPastPreparation.ts";
import { prepared } from "#test/preparation.ts";

for (const scenario of [
	{ code: "incomplete-context", contextComplete: false, observation: {} },
	{ code: "not-ancestor", contextComplete: true, observation: { ancestor: false } },
	{ code: "relevant-change", contextComplete: true, observation: {} },
]) {
	engine.it(
		`a repository-wide preparation that main left behind with ${scenario.code} launches on the observed main without a decision`,
		[mainMovedPastPreparation(scenario.code, scenario.observation)],
		function* (fleet) {
			const preparation = prepared({ contextComplete: scenario.contextComplete, ownedPaths: ["."], sourcePaths: [] });
			yield* fleet.prepare({ cwd: "/synthetic", preparation, prompt: "Implement one", workId: "one" });
			const launched = (yield* fleet.dispatch("one")).value;
			expect(launched.decision).toBeUndefined();
			expect(launched.step).toBe("working");
			expect(launched.preparation).toEqual({ ...preparation, baseRevision: "current-main", observedAt: 200 });
			expect(fleet.providerStarts().map(({ prompt }) => prompt)).toEqual(["Implement one"]);
		},
	);
}

engine.it(
	"a scoped preparation that main left behind still asks for a new preparation",
	[mainMovedPastPreparation("scoped context", {})],
	function* (fleet) {
		const preparation = prepared({ contextComplete: false, ownedPaths: ["src/one.ts"] });
		yield* fleet.prepare({ cwd: "/synthetic", preparation, prompt: "Implement one", workId: "one" });
		const stopped = (yield* fleet.dispatch("one")).value;
		expect(stopped).toMatchObject({ decision: { code: "incomplete-context" }, preparation, step: "waiting" });
		expect(fleet.providerStarts()).toEqual([]);
	},
);
