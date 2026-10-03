import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Cause, Option, Predicate } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect } from "react";
import { useSessionRecheck } from "./session-boundary.ts";

export interface ResultState<A, E> {
	readonly cause: Option.Option<Cause.Cause<E>>;
	readonly data: Option.Option<A>;
	readonly pending: boolean;
	readonly refreshing: boolean;
	readonly result: AsyncResult.AsyncResult<A, E>;
}

const state = <A, E>(result: AsyncResult.AsyncResult<A, E>): ResultState<A, E> => {
	const data = AsyncResult.value(result);
	return {
		cause: AsyncResult.cause(result),
		data,
		pending: result.waiting,
		refreshing: result.waiting && Option.isSome(data),
		result,
	};
};

export const isUnauthorized = <E>(cause: Cause.Cause<E>): boolean =>
	Option.match(Cause.findErrorOption(cause), { onNone: () => false, onSome: (error) => Predicate.isTagged(error, "Unauthorized") });

const useRecheckOnUnauthorized = <A, E>(result: AsyncResult.AsyncResult<A, E>): void => {
	const recheck = useSessionRecheck();
	useEffect(() => {
		if (AsyncResult.isFailure(result) && isUnauthorized(result.cause)) recheck();
	}, [recheck, result]);
};

export interface QueryState<A, E> extends ResultState<A, E> {
	readonly refresh: () => void;
}

export const useQuery = <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>): QueryState<A, E> => {
	const result = useAtomValue(atom);
	useRecheckOnUnauthorized(result);
	return { ...state(result), refresh: useAtomRefresh(atom) };
};

export interface ActionState<Input, A, E> extends ResultState<A, E> {
	readonly dispatch: (input: Input) => void;
}

// The atom's state is shared by every dispatch, so it never claims to be one invocation's completion result.
export const useAction = <Input, A, E>(atom: Atom.AtomResultFn<Input, A, E>): ActionState<Input, A, E> => {
	const result = useAtomValue(atom);
	useRecheckOnUnauthorized(result);
	return { ...state(result), dispatch: useAtomSet(atom) };
};
