import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { releaseOnly } from "#engine/decisionCopy.ts";
import { Fleet } from "#fleet.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { exhaustReadRetries } from "#test/exhaustReadRetries.ts";
import type { RecoveryContext } from "#test/recoveryCase.ts";

export const enterRecoveryCase = Effect.fn("Test.enterRecoveryCase")(function* (state: EngineStory) {
	const scenario = state.recoveryCase;
	if (scenario === undefined || state.github === undefined) {
		return yield* Effect.die("Missing configured recovery row");
	}
	const { fixture, fleet } = running(state);
	const context: RecoveryContext = { fixture, github: state.github, readRetries: [], root: state.root, source: state.source };
	yield* scenario.enter(context).pipe(Effect.provideService(Fleet, fleet));
	yield* exhaustReadRetries(fixture).pipe(Effect.provideService(Fleet, fleet));
	const before = (yield* fleet.get("one")).value;
	const decision = before.decision;
	if (decision?.published === undefined) {
		return yield* Effect.die("Decision must be durably published");
	}
	state.lastRecord = before;
	return {
		before,
		context,
		decision,
		document: readFileSync(join(context.root, decision.published.sourcePath), "utf8"),
		entryObservations: scenario.observe?.(),
		explanation: decision.worker === undefined ? releaseOnly(decision) : undefined,
		readRetries: context.readRetries,
		scenario,
		startsBefore: [...fixture.starts],
		submissionCalls: fixture.settings.length,
	};
});
