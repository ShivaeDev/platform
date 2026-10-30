import { Effect } from "effect";

export function runRuleEffect<A, E>(effect: Effect.Effect<A, E>): Promise<A> {
	return Effect.runPromise(effect);
}
