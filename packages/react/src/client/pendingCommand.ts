import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useContext, useMemo, useState } from "react";
import { type ActionState, useAction } from "./resultState.ts";

export interface PendingCommandOptions<TInput, TValue> {
	readonly queries: readonly Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>[];
	readonly value: TValue;
	readonly wanted: (input: TInput) => TValue;
}
export interface PendingCommandState<TInput, A, E, TValue> extends ActionState<TInput, A, E> {
	readonly value: TValue;
}

export function usePendingCommand<TInput, A, E, TValue>(
	atom: Atom.AtomResultFn<TInput, A, E>,
	options: PendingCommandOptions<TInput, TValue>,
): PendingCommandState<TInput, A, E, TValue> {
	const action = useAction(atom);
	const registry = useContext(RegistryContext);
	const { queries, value, wanted } = options;
	const waiting = useMemo(() => Atom.make((get) => queries.map((query) => get(query).waiting).some(Boolean)), [queries]);
	const refreshing = useAtomValue(waiting);
	const [held, hold] = useState({ atom, registry, value: Option.none<TValue>() });
	const sameOwner = held.atom === atom && held.registry === registry;
	const failed = AsyncResult.isFailure(action.result) && !action.pending;
	const pending = sameOwner && Option.isSome(held.value) && !failed && (action.pending || refreshing);
	if (!sameOwner || (Option.isSome(held.value) && !pending)) {
		hold({ atom, registry, value: Option.none() });
	}
	return {
		...action,
		dispatch: (input) => {
			hold({ atom, registry, value: Option.some(wanted(input)) });
			action.dispatch(input);
		},
		pending: action.pending || pending,
		value: pending ? Option.getOrElse(held.value, () => value) : value,
	};
}
