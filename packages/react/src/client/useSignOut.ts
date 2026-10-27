import { useRouter } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useEffect } from "react";
import { useAction } from "./resultState.ts";

declare module "@tanstack/react-router" {
	interface HistoryState {
		readonly __platformSignOut?: boolean;
	}
}

export function useSignOut<A, E>(action: Atom.AtomResultFn<void, A, E>, options: { readonly signIn: string }) {
	const router = useRouter({ warn: false });
	const state = useAction(action);
	useEffect(() => {
		if (router && AsyncResult.isSuccess(state.result) && !state.pending) {
			void router.navigate({ replace: true, state: { __platformSignOut: true }, to: options.signIn });
		}
		if (router && AsyncResult.isFailure(state.result) && !state.pending) {
			router.history.replace(router.history.location.href, { ...router.history.location.state, __platformSignOut: false });
		}
	}, [router, state.result, state.pending, options.signIn]);
	return {
		...state,
		dispatch: () => {
			if (router) {
				router.history.replace(router.history.location.href, { ...router.history.location.state, __platformSignOut: true });
			}
			state.dispatch();
		},
	};
}
