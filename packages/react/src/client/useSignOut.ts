import { RegistryContext, useAtomMount } from "@effect/atom-react";
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
	const source = useMemo(
		() =>
			Atom.writable(
				(get) => {
					get.addFinalizer(registry.subscribe(action, (result) => get.setSelf(result)));
					return registry.get(action);
				},
				(_, input: undefined | Atom.Reset | Atom.Interrupt) => registry.set(action, input),
			),
		[registry, action],
	);
	const followUp = useMemo(() => {
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
			AtomRegistry.getResult(registry, action, { suspendOnWaiting: true }).pipe(Effect.match({ onFailure: failed, onSuccess: completed })),
		);
	}, [registry, action, router, options.signIn]);
	useAtomMount(followUp);
	useEffect(() => () => local.set(followUp, Atom.Interrupt), [local, followUp]);
	const state = useAction(source);
	return {
		...state,
		dispatch: () => {
			if (registry.get(action).waiting || local.get(followUp).waiting) {
				return;
			}
			if (router) {
				router.history.replace(router.history.location.href, { ...router.history.location.state, __platformSignOut: true });
			}
			state.dispatch(undefined);
			local.set(followUp, undefined);
		},
	};
}
