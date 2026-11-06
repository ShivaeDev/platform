import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useEffect, useRef } from "react";
import { pendingLoaderQuery } from "./queryHandoff.ts";

export function useLoaderHandoff<A, E>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>): void {
	const committedRef = useRef<{ readonly registry: AtomRegistry.AtomRegistry; readonly atom: Atom.Atom<unknown> } | undefined>(undefined);
	useEffect(() => {
		committedRef.current = { atom, registry };
		return () => {
			committedRef.current = undefined;
		};
	}, [registry, atom]);
	if (Option.isSome(AsyncResult.value(registry.get(atom)))) {
		return;
	}
	if (committedRef.current?.registry !== registry || committedRef.current.atom !== atom) {
		const pending = pendingLoaderQuery(registry, atom);
		if (pending !== undefined) {
			throw pending;
		}
	}
}
