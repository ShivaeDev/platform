import { useAtomSuspense } from "@effect/atom-react";
import { Context, Crypto, Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useCallback } from "react";
import { handlerRuntime } from "#client/adapters/handlerRuntime.ts";

export function useNewId(runtime: Atom.Atom<AsyncResult.AsyncResult<Context.Context<Crypto.Crypto>, unknown>> = handlerRuntime): () => string {
	const crypto = Context.get(useAtomSuspense(runtime).value, Crypto.Crypto);
	return useCallback(() => Effect.runSync(crypto.randomUUIDv4()), [crypto]);
}
