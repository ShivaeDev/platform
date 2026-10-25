import { Effect } from "effect";
import { connect, request } from "#providers/codexRpc.ts";
import { SessionFailure } from "#session/schema.ts";
import type { CapacityRecoveryState } from "#test/capacityRecovery.ts";
import { codexServer, WireRejection } from "#test/codex.ts";

export const queueRecoverySetup = Effect.fn("Test.queueRecoverySetup")(function* (state: CapacityRecoveryState, call: "session" | "turn") {
	const wire = yield* codexServer(() => new WireRejection("No execution slots are available.", undefined, -32_001));
	const connection = yield* connect({ url: new URL(wire.endpoint) }, 1000);
	const rejected = yield* request(connection, 1000, "turn/start", {}, true).pipe(Effect.flip);
	state.capacity.rejection = rejected;
	const reworded = new SessionFailure({ ...rejected, message: "Please wait until the provider has room for another operation." });
	return {
		now: () => state.capacity.now,
		submissionFailure: (rejectedCall: "session" | "turn") => (state.capacity.reject && rejectedCall === call ? reworded : undefined),
	};
});

export function queueRecovery(state: CapacityRecoveryState) {
	return {
		capacityClock: (now: number) => {
			state.capacity.now = now;
		},
		providerHasRoom: () => {
			state.capacity.reject = false;
		},
		queueRejection: () => state.capacity.rejection,
	};
}
