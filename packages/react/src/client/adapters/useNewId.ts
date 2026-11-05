import { useAtomSuspense } from "@effect/atom-react";
import { Context, Effect } from "effect";
import { SecureRandom } from "effect/crypto";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useCallback } from "react";
import { handlerRuntime } from "#client/adapters/handlerRuntime.ts";

export function useNewId(
	runtime: Atom.Atom<AsyncResult.AsyncResult<Context.Context<SecureRandom.SecureRandom>, unknown>> = handlerRuntime,
): () => string {
	const random = Context.get(useAtomSuspense(runtime).value, SecureRandom.SecureRandom);
	return useCallback(() => Effect.runSync(random.uuidV4()), [random]);
}
