import type { LoaderFnContext } from "@tanstack/react-router";
import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

export async function loadQuery<A, E>(
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	{ abortController }: Pick<LoaderFnContext, "abortController">,
): Promise<A> {
	const { signal } = abortController;
	try {
		const result = await Effect.runPromise(Effect.result(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true })), { signal });
		if (result._tag === "Failure") {
			throw result.failure;
		}
		return result.success;
	} catch (error) {
		if (signal.aborted) {
			const canceled = new Error("Query loading canceled", { cause: error });
			canceled.name = "AbortError";
			throw canceled;
		}
		throw error;
	}
}
