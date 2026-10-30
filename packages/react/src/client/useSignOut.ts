import { RegistryContext } from "@effect/atom-react";
import { useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useEffect, useMemo } from "react";
import { SignOutRegistryContext } from "#internal/SignOutRegistryContext.ts";
import { useAction } from "./resultState.ts";

declare module "@tanstack/react-router" {
	interface HistoryState {
		readonly __platformSignOut?: boolean;
	}
}

export function useSignOut<A, E>(action: Atom.AtomResultFn<void, A, E>, options: { readonly signIn: string }) {
	const router = useRouter({ warn: false });
	const local = useContext(RegistryContext);
	const registry = useContext(SignOutRegistryContext) ?? local;
	const source = useMemo(() => {
		function failed() {
			if (router) {
				router.history.replace(router.history.location.href, { ...router.history.location.state, __platformSignOut: false });
			}
		}
		function completed() {
			if (router) {
				void router.navigate({ replace: true, state: { __platformSignOut: true }, to: options.signIn });
			}
		}
		return Atom.fn<void>()(() =>
			Effect.gen(function* () {
				registry.set(action, undefined);
				return yield* AtomRegistry.getResult(registry, action, { suspendOnWaiting: true }).pipe(
					Effect.tapError(() => Effect.sync(failed)),
					Effect.tap(() => Effect.sync(completed)),
				);
			}),
		);
	}, [registry, action, router, options.signIn]);
	const state = useAction(source);
	useEffect(() => () => local.set(source, Atom.Interrupt), [local, source]);
	return {
		...state,
		dispatch: () => {
			if (local.get(source).waiting) {
				return;
			}
			if (router) {
				router.history.replace(router.history.location.href, { ...router.history.location.state, __platformSignOut: true });
			}
			state.dispatch(undefined);
		},
	};
}
