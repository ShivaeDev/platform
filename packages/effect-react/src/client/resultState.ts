import { RegistryContext, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Cause, type Duration, type Effect, Option, Predicate } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useEffect, useState } from "react";
import { queryCoalesceWindow } from "@shivaedev/effect-contract/queryCoalesceWindow.ts";
import type { AtomServices } from "#fieldRejection.ts";
import { acceptLoaderQuery } from "#internal/queryHandoff.ts";
import { useQueryNotice } from "#internal/useQueryNotice.ts";
import type { NoticeDescriptor } from "#notices.ts";
import { type ActionOptions, useActionSource } from "./actionCompletion.ts";
import { useSessionRecheck } from "./sessionBoundary.ts";

export interface ResultState<A, E> {
	readonly cause: Option.Option<Cause.Cause<E>>;
	readonly data: Option.Option<A>;
	readonly pending: boolean;
	readonly refreshing: boolean;
	readonly result: AsyncResult.AsyncResult<A, E>;
}
function state<A, E>(result: AsyncResult.AsyncResult<A, E>, data = AsyncResult.value(result)): ResultState<A, E> {
	return {
		cause: AsyncResult.cause(result),
		data,
		pending: result.waiting,
		refreshing: result.waiting && Option.isSome(data),
		result,
	};
}
export function isUnauthorized<E>(cause: Cause.Cause<E>): boolean {
	return Option.match(Cause.findErrorOption(cause), { onNone: () => false, onSome: (error) => Predicate.isTagged(error, "Unauthorized") });
}
function useRecheckOnUnauthorized<A, E>(result: AsyncResult.AsyncResult<A, E>, enabled = true): void {
	const recheck = useSessionRecheck();
	useEffect(() => {
		if (enabled && AsyncResult.isFailure(result) && isUnauthorized(result.cause)) {
			recheck();
		}
	}, [enabled, recheck, result]);
}
export interface QueryState<A, E> extends ResultState<A, E> {
	readonly refresh: () => void;
}
export interface QueryOptions<E = unknown> {
	readonly coalesceWindow?: Duration.Input | undefined;
	readonly keepPreviousData?: boolean;
	readonly notice?: (failure: { readonly cause: Cause.Cause<E>; readonly refreshing: boolean }) => NoticeDescriptor | undefined;
}
interface HeldQuery<A, E> {
	readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	readonly data: Option.Option<A>;
	readonly dataAtom: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	readonly keepPreviousData: boolean;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly result: AsyncResult.AsyncResult<A, E>;
}
export function useQuery<A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>, options: QueryOptions<E> = {}): QueryState<A, E> {
	const result = useAtomValue(atom);
	const registry = useContext(RegistryContext);
	useEffect(() => acceptLoaderQuery(registry, atom), [registry, atom]);
	useEffect(() => {
		if (options.coalesceWindow === undefined) {
			return;
		}
		const window = queryCoalesceWindow(atom);
		registry.set(window, options.coalesceWindow);
		return () => registry.set(window, undefined);
	}, [registry, atom, options.coalesceWindow]);
	const keepPreviousData = options.keepPreviousData === true;
	const nativeData = AsyncResult.value(result);
	const [held, hold] = useState<HeldQuery<A, E>>(() => ({ atom, data: nativeData, dataAtom: atom, keepPreviousData, registry, result }));
	const previous = held.registry === registry && (held.dataAtom === atom || keepPreviousData) ? held.data : Option.none<A>();
	const data = Option.orElse(nativeData, () => previous);
	const dataAtom = Option.isSome(nativeData) || Option.isNone(previous) ? atom : held.dataAtom;
	// Render state keeps abandoned React renders from changing the committed screen's retained value.
	if (held.atom !== atom || held.registry !== registry || held.result !== result || held.keepPreviousData !== keepPreviousData) {
		hold({ atom, data, dataAtom, keepPreviousData, registry, result });
	}
	useRecheckOnUnauthorized(result);
	useQueryNotice(result, Option.isSome(data), options.notice);
	return { ...state(result, data), refresh: useAtomRefresh(atom) };
}
export interface ActionState<TInput, A, E> extends ResultState<A, E> {
	readonly dispatch: (input: TInput) => void;
}
export function useAction<TInput, A, E>(atom: Atom.AtomResultFn<TInput, A, E>): ActionState<TInput, A, E>;
export function useAction<TInput, A, E, R, TRuntimeError>(
	runtime: Atom.AtomRuntime<R, TRuntimeError>,
	run: (input: TInput) => Effect.Effect<A, E, AtomServices<R>>,
	options?: ActionOptions<NoInfer<TInput>, NoInfer<A>, NoInfer<E>, R>,
): ActionState<TInput, A, E | TRuntimeError>;
export function useAction<TInput, A, E, R, TRuntimeError>(
	source: Atom.AtomResultFn<TInput, A, E> | Atom.AtomRuntime<R, TRuntimeError>,
	run?: (input: TInput) => Effect.Effect<A, E, AtomServices<R>>,
	options: ActionOptions<TInput, A, E, R> = {},
): ActionState<TInput, A, E | TRuntimeError> {
	const atom = useActionSource(source, run, options);
	const result = useAtomValue(atom);
	useRecheckOnUnauthorized(result, run === undefined);
	return { ...state(result), dispatch: useAtomSet(atom) };
}
