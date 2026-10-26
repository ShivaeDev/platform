import { Effect } from "effect";
import { Forbidden } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { admit } from "#admit.ts";
import { failureContext, withFailureContext } from "#engine/failureContext.ts";
import { boardWork } from "#test/boardWork.ts";
import type { CapacityRecoveryState } from "#test/capacityRecovery.ts";
import { enginePolicy } from "#test/enginePolicy.ts";

export const quotaRecoverySetup = Effect.fn("Test.quotaRecoverySetup")(function* (state: CapacityRecoveryState) {
	const work = boardWork("one", { one: "board-one" });
	const denied = yield* admit(work, [], enginePolicy({ quota: 0 }), () => Effect.succeed(work)).pipe(Effect.flip);
	state.capacity.admissionFailure = denied;
	const reworded = withFailureContext(
		new Forbidden({ message: "The provider budget needs to refresh before another operation can start." }),
		failureContext(denied),
	);
	return { noChange: true, refreshQuota: () => (state.capacity.blocked ? Effect.fail(reworded) : Effect.succeed(enginePolicy({}).quota)) };
});

export function quotaRecovery(state: CapacityRecoveryState) {
	return {
		quotaBlocked: (blocked: boolean) => {
			state.capacity.blocked = blocked;
		},
		quotaDenial: () => state.capacity.admissionFailure,
	};
}
