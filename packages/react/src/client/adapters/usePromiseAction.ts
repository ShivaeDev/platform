import { Cause, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useInsertionEffect, useRef, useState } from "react";
import { type ActionState, useAction } from "#client/resultState.ts";

export function usePromiseAction<A>(run: () => PromiseLike<A>): ActionState<void, A, Cause.UnknownError>;
export function usePromiseAction<A, E>(run: () => PromiseLike<A>, options: { readonly catch: (cause: unknown) => E }): ActionState<void, A, E>;
export function usePromiseAction<A, E>(
	run: () => PromiseLike<A>,
	options?: { readonly catch: (cause: unknown) => E },
): ActionState<void, A, E | Cause.UnknownError> {
	const latestRef = useRef({ reject: options?.catch, run });
	useInsertionEffect(() => {
		latestRef.current = { reject: options?.catch, run };
	}, [run, options?.catch]);
	const [atom] = useState(() =>
		Atom.fn<void>()(() =>
			Effect.tryPromise({
				catch: (cause) => (latestRef.current.reject ? latestRef.current.reject(cause) : new Cause.UnknownError(cause)),
				try: () => latestRef.current.run(),
			}),
		),
	);
	return useAction(atom);
}
