import { RegistryContext } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useContext, useMemo, useState } from "react";
import { untilReflected } from "@shivaedev/contract/commandSignal.ts";
import type { BoundOperation } from "#client/boundOperation.ts";
import type { FailuresOption } from "#client/failures.ts";
import type { NoticeDescriptor } from "#client/notices.ts";
import { type ActionState, useActionState } from "#client/resultState.ts";

export type PendingCommandOptions<TInput, TValue, E = never, R = never, TSilent extends boolean = false> = {
	readonly value: TValue;
	readonly wanted: (input: TInput) => TValue;
} & FailuresOption<E, TInput, NoticeDescriptor<R>, TSilent>;
export interface PendingCommandState<TInput, A, E, TValue> extends ActionState<TInput, A, E> {
	readonly value: TValue;
}

export function usePendingCommand<TInput, A, E, R, TRuntimeError, TValue, TSilent extends boolean = false>(
	command: BoundOperation<TInput, A, E, R, TRuntimeError>,
	options: PendingCommandOptions<NoInfer<TInput>, TValue, E, R, TSilent>,
): PendingCommandState<TInput, A, E | TRuntimeError, TValue> {
	const { run, runtime } = command;
	const { failures, silent, value, wanted } = options;
	// The reply arrives before the live queries the command changed are updated, so the action ends when the command is reflected.
	const reflected = useMemo(() => (input: TInput) => untilReflected(run(input)), [run]);
	const action = useActionState({ run: reflected, runtime }, { failures, silent });
	const registry = useContext(RegistryContext);
	const [held, hold] = useState({ reflected, registry, value: Option.none<TValue>() });
	const sameOwner = held.reflected === reflected && held.registry === registry;
	const failed = AsyncResult.isFailure(action.result) && !action.pending;
	const pending = sameOwner && Option.isSome(held.value) && !failed && action.pending;
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
