import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useContext, useMemo, useState } from "react";
import { type ActionState, useAction } from "#client/resultState.ts";

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
	const watched = useMemo(() => Atom.make((get) => queries.map((query) => get(query))), [queries]);
	const results = useAtomValue(watched);
	const [held, hold] = useState({ atom, before: results, registry, value: Option.none<TValue>() });
	const sameOwner = held.atom === atom && held.registry === registry;
	const failed = AsyncResult.isFailure(action.result) && !action.pending;
	const refreshing = results.some((result) => result.waiting);
	// A live query answers with a pushed Result instead of a reload, so the hold waits for any new settled Result.
	const answered = results.some((result, index) => !result.waiting && result !== held.before[index]);
	const pending = sameOwner && Option.isSome(held.value) && !failed && (action.pending || refreshing || !answered);
	if (!sameOwner || (Option.isSome(held.value) && !pending)) {
		hold({ atom, before: results, registry, value: Option.none() });
	}
	return {
		...action,
		dispatch: (input) => {
			hold({ atom, before: registry.get(watched), registry, value: Option.some(wanted(input)) });
			action.dispatch(input);
		},
		pending: action.pending || pending,
		value: pending ? Option.getOrElse(held.value, () => value) : value,
	};
}
