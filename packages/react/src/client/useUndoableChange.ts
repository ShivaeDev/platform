import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Effect, Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useContext, useMemo } from "react";
import type { AtomServices } from "#AtomServices.ts";
import type { deployUpdate } from "#client/deployUpdate.ts";
import { useAction } from "#client/resultState.ts";

export interface VersionedChangeCommand<TInput, A, E, R, TRuntimeError> {
	readonly run: (input: TInput) => Effect.Effect<A, E, AtomServices<R>>;
	readonly runtime: Atom.AtomRuntime<R, TRuntimeError>;
	readonly update: Pick<ReturnType<typeof deployUpdate>, "block">;
}

export interface UndoableNotice<TInput, A> {
	readonly input: TInput;
	readonly message: string;
	readonly value: A;
}

export interface UndoableChange<TInput, A, E, TInverse extends readonly unknown[]> {
	readonly notice: Option.Option<UndoableNotice<TInput, A>>;
	readonly pending: boolean;
	readonly remove: (input: TInput, ...inverse: TInverse) => void;
	readonly removeResult: AsyncResult.AsyncResult<A, E>;
	readonly removing: boolean;
	readonly undo: () => void;
	readonly undoing: boolean;
	readonly undoResult: AsyncResult.AsyncResult<A, E>;
}

export function useUndoableChange<TInput, A, E, R, TRuntimeError>(
	command: VersionedChangeCommand<TInput, A, E, R, TRuntimeError>,
	options: {
		readonly describe: (value: NoInfer<A>, input: NoInfer<TInput>) => string;
		readonly undoInput: (value: NoInfer<A>, input: NoInfer<TInput>) => NoInfer<TInput>;
	},
): UndoableChange<TInput, A, E | TRuntimeError, []>;
export function useUndoableChange<TInput extends { readonly expectedVersion: number }, A extends { readonly version: number }, E, R, TRuntimeError>(
	command: VersionedChangeCommand<TInput, A, E, R, TRuntimeError>,
	options: { readonly describe: (value: NoInfer<A>, input: NoInfer<TInput>) => string },
): UndoableChange<TInput, A, E | TRuntimeError, [inverse: Omit<TInput, "expectedVersion">]>;
export function useUndoableChange<TInput, A extends { readonly version: number }, E, R, TRuntimeError>(
	command: VersionedChangeCommand<TInput, A, E, R, TRuntimeError>,
	options: {
		readonly describe: (value: A, input: TInput) => string;
		readonly undoInput?: (value: A, input: TInput) => TInput;
	},
) {
	const { run, runtime, update } = command;
	const registry = useContext(RegistryContext);
	type Entry = UndoableNotice<TInput, A> & { readonly inverse: TInput };
	interface Removal {
		readonly input: TInput;
		readonly inverse: Omit<TInput, "expectedVersion"> | undefined;
		readonly sequence: number;
	}
	const owner = useMemo(
		() => ({ notice: Atom.make(Option.none<Entry>()), registry, run, runtime, sequence: 0, update }),
		[run, runtime, update, registry],
	);
	const execute = useMemo(
		() => (input: TInput) =>
			Effect.acquireUseRelease(
				owner.update.block,
				() => owner.run(input),
				(release) => Effect.sync(release),
			),
		[owner],
	);
	const removeRun = useMemo(() => (request: Removal) => execute(request.input), [execute]);
	const undoRun = useMemo(() => (entry: Entry) => execute(entry.inverse), [execute]);
	const removal = useAction(owner.runtime, removeRun, {
		concurrent: true,
		onSuccess: (value, { input, inverse, sequence }) => {
			if (sequence === owner.sequence) {
				const undoInput = options.undoInput ? options.undoInput(value, input) : { ...input, ...inverse, expectedVersion: value.version };
				owner.registry.set(owner.notice, Option.some({ input, inverse: undoInput, message: options.describe(value, input), value }));
			}
		},
	});
	const restoration = useAction(owner.runtime, undoRun, {
		onSuccess: (_value, entry) => {
			if (Option.getOrUndefined(owner.registry.get(owner.notice)) === entry) {
				owner.registry.set(owner.notice, Option.none());
			}
		},
	});
	const notice: Option.Option<UndoableNotice<TInput, A>> = useAtomValue(owner.notice);
	return {
		notice,
		pending: removal.pending || restoration.pending,
		remove: (input: TInput, inverse?: Omit<TInput, "expectedVersion">) => {
			owner.sequence += 1;
			removal.dispatch({ input, inverse, sequence: owner.sequence });
		},
		removeResult: removal.result,
		removing: removal.pending,
		undo: () => {
			const current = owner.registry.get(owner.notice);
			if (Option.isSome(current)) {
				restoration.dispatch(current.value);
			}
		},
		undoing: restoration.pending,
		undoResult: restoration.result,
	};
}
