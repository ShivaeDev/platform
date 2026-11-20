import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useContext, useMemo, useState } from "react";
import { untilReflected } from "@shivaedev/contract/commandSignal.ts";
import type { BoundOperation } from "#client/boundOperation.ts";
import { type ActionState, useAction } from "#client/resultState.ts";

export interface PendingCommandOptions<TInput, TValue> {
	readonly queries?: readonly Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>[];
	readonly value: TValue;
	readonly wanted: (input: TInput) => TValue;
}
export interface PendingCommandState<TInput, A, E, TValue> extends ActionState<TInput, A, E> {
	readonly value: TValue;
}

const NO_QUERIES: readonly Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>[] = [];

export function usePendingCommand<TInput, A, E, R, TRuntimeError, TValue>(
	command: BoundOperation<TInput, A, E, R, TRuntimeError>,
	options: PendingCommandOptions<NoInfer<TInput>, TValue>,
): PendingCommandState<TInput, A, E | TRuntimeError, TValue> {
	const { run, runtime } = command;
	const { queries = NO_QUERIES, value, wanted } = options;
	// The reply arrives before the live queries the command changed are updated, so the action ends when the command is reflected.
	const reflected = useMemo(() => (input: TInput) => untilReflected(run(input)), [run]);
	const action = useAction({ run: reflected, runtime });
	const registry = useContext(RegistryContext);
	const refreshing = useAtomValue(useMemo(() => Atom.make((get) => queries.some((query) => get(query).waiting)), [queries]));
	const [held, hold] = useState({ reflected, registry, value: Option.none<TValue>() });
	const sameOwner = held.reflected === reflected && held.registry === registry;
	const failed = AsyncResult.isFailure(action.result) && !action.pending;
	const pending = sameOwner && Option.isSome(held.value) && !failed && (action.pending || refreshing);
	if (!sameOwner || (Option.isSome(held.value) && !pending)) {
		hold({ reflected, registry, value: Option.none() });
	}
	return {
		...action,
		dispatch: (input) => {
			hold({ reflected, registry, value: Option.some(wanted(input)) });
			action.dispatch(input);
		},
		pending: action.pending || pending,
		value: pending ? Option.getOrElse(held.value, () => value) : value,
	};
}
