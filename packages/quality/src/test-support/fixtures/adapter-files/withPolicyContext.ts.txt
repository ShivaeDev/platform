import { Effect } from "effect";
import type { Rpc } from "effect/rpc";
import { policyContext } from "#policyContext.ts";

export const withPolicyContext = Effect.fn("ReadPolicy.withPolicyContext")(function* <A, E, R>(rpc: Rpc.Any, effect: Effect.Effect<A, E, R>) {
	const context = yield* policyContext(rpc);
	return yield* Effect.provideContext(effect, context);
});
