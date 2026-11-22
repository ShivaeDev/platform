import { Cause, Effect, Layer, Option, Predicate } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { type ContextType, useContext, useEffect, useInsertionEffect, useRef } from "react";
import { type FailureHost, FailureHostContext } from "#client/FailureHostContext.ts";
import { decide, defaultRetry } from "#client/failureDecision.ts";
import type { FailureChoices } from "#client/failures.ts";
import { NoticeContext } from "#client/NoticeContext.ts";
import { unexpectedFailure } from "#client/unexpectedFailure.ts";
import { publishNotice } from "#noticeStore.ts";

const runtime = Atom.runtime(Layer.empty);

function noField(): undefined {
	return undefined;
}

// A lost connection keeps the screen loading until the socket returns, and a refused read is the query's `denied` state.
function shownByScreen(error: unknown): boolean {
	return Predicate.isTagged(error, "RpcClientError") || Predicate.isTagged(error, "QueryReadDenied");
}

interface Hosts {
	readonly host: FailureHost | undefined;
	readonly store: ContextType<typeof NoticeContext>;
}

function present(cause: Cause.Cause<unknown>, choices: FailureChoices, retry: () => void, { host, store }: Hosts): (() => void) | undefined {
	const error = Cause.findErrorOption(cause);
	if (Option.isNone(error)) {
		return Cause.hasDies(cause) ? host?.report(unexpectedFailure(cause), retry) : undefined;
	}
	if (shownByScreen(error.value)) {
		return undefined;
	}
	const decision = decide<never>(error.value, undefined, choices, noField);
	if (decision._tag === "notice") {
		const action = decision.descriptor.action ?? defaultRetry(error.value, { label: "Retry", run: Effect.sync(retry) });
		return publishNotice(store, runtime, action === undefined ? decision.descriptor : { ...decision.descriptor, action }, "rejection");
	}
	return decision._tag === "unexpected" ? host?.report(unexpectedFailure(cause), defaultRetry(error.value, retry)) : undefined;
}

// A loaded query always has data on screen, so its failed refreshes go to the notice host, one notice at a time, until it next succeeds.
export function useLoadedQueryFailures<A, E>(
	result: AsyncResult.AsyncResult<A, E>,
	refresh: () => void,
	choices: FailureChoices,
	enabled = true,
): void {
	const store = useContext(NoticeContext);
	const host = useContext(FailureHostContext);
	const latestRef = useRef({ choices, refresh });
	useInsertionEffect(() => {
		latestRef.current = { choices, refresh };
	}, [choices, refresh]);
	const seenRef = useRef<AsyncResult.AsyncResult<A, E> | undefined>(undefined);
	const shownRef = useRef<(() => void) | undefined>(undefined);
	useEffect(() => {
		if (!enabled || result.waiting || seenRef.current === result) {
			return;
		}
		seenRef.current = result;
		shownRef.current?.();
		function retry() {
			latestRef.current.refresh();
		}
		shownRef.current = AsyncResult.isFailure(result) ? present(result.cause, latestRef.current.choices, retry, { host, store }) : undefined;
	}, [enabled, host, result, store]);
}
