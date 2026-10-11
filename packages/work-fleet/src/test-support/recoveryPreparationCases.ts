import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { mainObservation, prepared } from "#test/preparation.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";

export const recoveryPreparationCases: readonly RecoveryCase[] = [
	{ name: "incomplete-observation", observation: { complete: false } },
	{ name: "not-ancestor", observation: { ancestor: false } },
	{ name: "incomplete-context", observation: {}, preparation: { contextComplete: false } },
	{ name: "relevant-change", observation: { changedPaths: ["src/one.ts"] } },
].map((scenario) => ({
	enter: Effect.fnUntraced(function* () {
		const fleet = yield* Fleet;
		yield* fleet.prepare({
			cwd: "/synthetic",
			preparation: prepared({ ownedPaths: ["src/one.ts"], ...scenario.preparation }),
			prompt: "Implement scoped work",
			workId: "one",
		});
		yield* fleet.dispatch("one");
	}),
	name: scenario.name,
	options: { mainQuery: () => Effect.succeed(mainObservation(scenario.observation)) },
	reason: scenario.name,
	sites: ["engine/dispatchCommand.ts: assessment.reason"],
}));
