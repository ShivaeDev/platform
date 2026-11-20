import { RegistryContext, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useContext, useMemo, useState } from "react";

export function useActionResult<A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
	const registry = useContext(RegistryContext);
	const [held, hold] = useState(() => {
		const pending: (typeof atom)[] = [];
		return { atom, pending, registry };
	});
	const pending =
		held.registry === registry
			? [...held.pending, ...(held.atom === atom ? [] : [held.atom])].filter((previous) => previous !== atom && registry.get(previous).waiting)
			: [];
	let tracked = held;
	if (
		held.atom !== atom
		|| held.registry !== registry
		|| pending.length !== held.pending.length
		|| pending.some((value, i) => value !== held.pending[i])
	) {
		tracked = { atom, pending, registry };
		hold(tracked);
	}
	const result = useMemo(
		() =>
			Atom.make((get) => {
				const current = get(atom);
				const waiting = tracked.pending.map((previous) => get(previous).waiting).some(Boolean);
				return waiting ? AsyncResult.waiting(current) : current;
			}),
		[atom, tracked.pending],
	);
	return useAtomValue(result);
}
