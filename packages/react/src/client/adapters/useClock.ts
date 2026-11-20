import { useAtomSuspense } from "@effect/atom-react";
import { Clock, Context } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useCallback } from "react";
import { handlerRuntime } from "#client/handlerRuntime.ts";

export function useClock(runtime: Atom.Atom<AsyncResult.AsyncResult<Context.Context<never>, unknown>> = handlerRuntime): () => number {
	const clock = Context.get(useAtomSuspense(runtime).value, Clock.Clock);
	return useCallback(() => clock.currentTimeMillisUnsafe(), [clock]);
}
