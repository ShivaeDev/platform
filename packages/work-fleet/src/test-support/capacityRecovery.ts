import { withTestTransaction } from "@shivaedev/effect-test-sql/server/withTestTransaction.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { SessionFailure } from "#session/schema.ts";
import { type EngineStory, newEngineState } from "#test/engineState.ts";
import { engineStoryDefinition } from "#test/engineStory.ts";
import { engineVerbs } from "#test/engineVerbs.ts";
import { queueRecovery, queueRecoverySetup } from "#test/queueRecovery.ts";
import { quotaRecovery, quotaRecoverySetup } from "#test/quotaRecovery.ts";
import { recoveryInventory } from "#test/recoveryInventory.ts";

export const capacityRecovery = {
	...engineStoryDefinition,
	around: withTestTransaction,
	clock: "live" as const,
	create: (): CapacityRecoveryState => ({ ...newEngineState(), capacity: { blocked: false, now: 100, reject: true } }),
	verbs: (state: CapacityRecoveryState, story: Parameters<typeof engineVerbs>[1]) => ({
		...engineVerbs(state, story),
		...queueRecovery(state),
		...quotaRecovery(state),
		inventory: recoveryInventory,
	}),
};
export interface CapacityRecoveryState extends EngineStory {
	capacity: { blocked: boolean; now: number; reject: boolean; rejection?: SessionFailure; admissionFailure?: unknown };
}
const capacity = storyKit(capacityRecovery);

export function capacityCase(call: "session" | "turn" | "quota") {
	return capacity.trait("configuration", `provider rejects ${call} admission`, function* (state) {
		state.options = yield* call === "quota" ? quotaRecoverySetup(state) : queueRecoverySetup(state, call);
	});
}
