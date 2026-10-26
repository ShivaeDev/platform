import { Effect } from "effect";
import { act } from "react";

export function withReact<A, E>(effect: Effect.Effect<A, E>) {
	return Effect.promise(async () => await act(async () => await Effect.runPromise(effect)));
}
