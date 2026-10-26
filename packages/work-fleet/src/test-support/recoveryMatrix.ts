import { Effect } from "effect";
import { withTestTransaction } from "@shivaedev/test-sql/server/withTestTransaction.ts";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import type { EngineStory } from "#test/engineState.ts";
import { engine, engineDefinition } from "#test/engineStory.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { type RecoveryCaseGroup, recoveryCaseGroups } from "#test/recoveryCases.ts";
import { runRecoveryCase } from "#test/runRecoveryCase.ts";

export const recoveryMatrix = {
	...engineDefinition,
	around: withTestTransaction,
	verbs: (state: EngineStory, story: Story<EngineStory>) => runRecoveryCase(state, story.tell),
};

export function recoveryRow(group: RecoveryCaseGroup, row: number) {
	return engine.trait("configuration", `prepare ${group} recovery row ${row}`, function* (state) {
		const scenario = recoveryCaseGroups[group]()[row];
		if (scenario === undefined) {
			return yield* Effect.die("Missing matrix row");
		}
		state.recoveryCase = scenario;
		state.github = yield* mergedReviewGithub();
		state.markdown = true;
		state.options = { ...state.github, reviewRunning: true, ...scenario.options };
	});
}
