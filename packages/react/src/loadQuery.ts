import type { LoaderFnContext } from "@tanstack/react-router";
import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { keepLoaderQuery } from "#internal/queryHandoff.ts";
import { recheckUnauthorized } from "#internal/sessionRecheck.ts";

export async function loadQuery<A, E>(
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	{ abortController }: Pick<LoaderFnContext, "abortController">,
): Promise<A> {
	const { signal } = abortController;
	const handoff = keepLoaderQuery(registry, atom, signal);
	try {
		const result = await Effect.runPromise(Effect.result(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true })), { signal });
		if (result._tag === "Failure") {
			await recheckUnauthorized(registry, result.failure);
			throw result.failure;
		}
		return result.success;
	} catch (error) {
		handoff.release();
		if (signal.aborted) {
			const canceled = new Error("Query loading canceled", { cause: error });
			canceled.name = "AbortError";
			throw canceled;
		}
		throw error;
	} finally {
		handoff.complete();
	}
}
