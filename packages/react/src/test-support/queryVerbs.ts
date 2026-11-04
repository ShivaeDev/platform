import { Cause, Deferred, Effect, Exit } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import type { QueryOptions } from "#client/resultState.ts";
import { queryReadouts } from "./queryReadouts.ts";
import { native, type State, view } from "./queryState.ts";
import type { Unavailable } from "./queryView.ts";
import type { Screen } from "./Screen.ts";

export function queryVerbs(state: State, screen: Screen) {
	function settle(label: string, line: string, result: Exit.Exit<string, Unavailable>) {
		return screen.act(line, () => Effect.runPromise(Deferred.done(state.reads.held(label), result)));
	}
	return {
		...queryReadouts(state),
		answer: (label: string, value: string) => settle(label, `read ${label} answers ${value}`, Exit.succeed(value)),
		changePayload: (payload: string, options?: QueryOptions) => {
			state.reads.next(payload);
			state.payload = payload;
			const kept = options?.keepPreviousData === undefined ? "" : ` with keepPreviousData ${options.keepPreviousData}`;
			return screen.act(`change the query's payload to ${payload}${kept}`, () => view(state).render(state.reads.queries(payload), options));
		},
		clickRetry: () => {
			state.reads.next("retry");
			return screen.driver(view(state).container).click({ name: "Retry", role: "button" });
		},
		die: (label: string, defect: unknown) => settle(label, `read ${label} dies`, Exit.die(defect)),
		fail: (label: string, message: string) =>
			settle(label, `read ${label} fails as Unavailable: ${message}`, Exit.fail({ _tag: "Unavailable", message })),
		interruptedReads: () =>
			Effect.promise(async () => {
				await act(async () => undefined);
				return [...state.reads.interrupted];
			}),
		invalidate: (label: string) => {
			state.reads.next(label);
			return screen.act(`invalidate the reports, starting read ${label}`, () => view(state).invalidate(state.reads.invalidation));
		},
		*moveToAnotherRegistry() {
			state.reads.next("first");
			screen.tell("render the query from another registry");
			const registry = yield* Effect.acquireRelease(
				Effect.sync(() => AtomRegistry.make()),
				(owner) => Effect.promise(view(state).unmount).pipe(Effect.ensuring(Effect.sync(() => owner.dispose()))),
			);
			yield* Effect.promise(() => act(() => view(state).render(state.reads.queries("first"), { keepPreviousData: true }, registry)));
		},
		nativeFails: (message: string) =>
			screen.act(`the native query fails as Unavailable: ${message}`, () => {
				view(state).registry.set(native(state), AsyncResult.failure(Cause.fail({ _tag: "Unavailable", message } as const)));
			}),
		nativeRefreshDropsAnswer: () =>
			screen.act("the native query starts a refresh whose result drops its previous answer", () => {
				view(state).registry.set(native(state), AsyncResult.initial(true));
			}),
		refresh: (label = "refresh") => {
			state.reads.next(label);
			return screen.act(`click Refresh, starting read ${label}`, () => {
				const button = view(state).container.querySelector("button");
				if (!button) {
					throw new Error("Missing query refresh button");
				}
				button.click();
			});
		},
		turnOffRetention: () =>
			screen.act("turn keepPreviousData off for the current payload", () =>
				view(state).render(state.reads.queries(state.payload), { keepPreviousData: false }),
			),
		type: (name: string, value: string) => screen.driver(view(state).container).enter(`input[name="${name}"]`, value),
	};
}
