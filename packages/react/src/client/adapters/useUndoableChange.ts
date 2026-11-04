import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Effect, Option } from "effect";
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

export function useUndoableChange<TInput extends { readonly expectedVersion: number }, A extends { readonly version: number }, E, R, TRuntimeError>(
	command: VersionedChangeCommand<TInput, A, E, R, TRuntimeError>,
	options: { readonly describe: (value: NoInfer<A>, input: NoInfer<TInput>) => string },
) {
	const { run, runtime, update } = command;
	const registry = useContext(RegistryContext);
	type Entry = UndoableNotice<TInput, A> & { readonly inverse: Omit<TInput, "expectedVersion"> };
	interface Removal {
		readonly input: TInput;
		readonly inverse: Omit<TInput, "expectedVersion">;
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
	const undoRun = useMemo(() => (entry: Entry) => execute({ ...entry.input, ...entry.inverse, expectedVersion: entry.value.version }), [execute]);
	const removal = useAction(owner.runtime, removeRun, {
		concurrent: true,
		onSuccess: (value, { input, inverse, sequence }) => {
			if (sequence === owner.sequence) {
				owner.registry.set(owner.notice, Option.some({ input, inverse, message: options.describe(value, input), value }));
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
		remove: (input: TInput, inverse: Omit<TInput, "expectedVersion">) => {
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
