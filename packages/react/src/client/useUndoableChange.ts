import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Effect, Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useContext, useMemo } from "react";
import type { BoundOperation } from "#client/boundOperation.ts";
import type { deployUpdate } from "#client/deployUpdate.ts";
import type { FailureChoices, FailuresOption } from "#client/failures.ts";
import type { NoticeDescriptor } from "#client/notices.ts";
import { useActionState } from "#client/resultState.ts";

type DeployUpdate = Pick<ReturnType<typeof deployUpdate>, "block">;

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

function failuresFor<TAction>(choices: FailureChoices, input: (action: TAction) => unknown): FailureChoices {
	const { failures, silent } = choices;
	const handlers =
		failures
		&& Object.fromEntries(
			Object.entries(failures).map(([tag, choice]) => [
				tag,
				typeof choice === "function" ? (error: unknown, action: TAction) => choice(error, input(action)) : choice,
			]),
		);
	return { failures: handlers, silent };
}
// A failed removal or Undo hands the change's own input to `failures`.
type UndoableFailures<TInput, E, R, TSilent extends boolean> = FailuresOption<E, TInput, NoticeDescriptor<R>, TSilent>;

export function useUndoableChange<TInput, A, E, R, TRuntimeError, TSilent extends boolean = false>(
	command: BoundOperation<TInput, A, E, R, TRuntimeError>,
	options: {
		readonly describe: (value: NoInfer<A>, input: NoInfer<TInput>) => string;
		readonly undoInput: (value: NoInfer<A>, input: NoInfer<TInput>) => NoInfer<TInput>;
		readonly update: DeployUpdate;
	} & UndoableFailures<NoInfer<TInput>, E, R, TSilent>,
): UndoableChange<TInput, A, E | TRuntimeError, []>;
export function useUndoableChange<
	TInput extends { readonly expectedVersion: number },
	A extends { readonly version: number },
	E,
	R,
	TRuntimeError,
	TSilent extends boolean = false,
>(
	command: BoundOperation<TInput, A, E, R, TRuntimeError>,
	options: { readonly describe: (value: NoInfer<A>, input: NoInfer<TInput>) => string; readonly update: DeployUpdate } & UndoableFailures<
		NoInfer<TInput>,
		E,
		R,
		TSilent
	>,
): UndoableChange<TInput, A, E | TRuntimeError, [inverse: Omit<TInput, "expectedVersion">]>;
export function useUndoableChange<TInput, A extends { readonly version: number }, E, R, TRuntimeError>(
	command: BoundOperation<TInput, A, E, R, TRuntimeError>,
	options: {
		readonly describe: (value: A, input: TInput) => string;
		readonly undoInput?: (value: A, input: TInput) => TInput;
		readonly update: DeployUpdate;
	} & FailureChoices,
) {
	const { run, runtime } = command;
	const { update } = options;
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
	const removal = useActionState(
		{ run: removeRun, runtime: owner.runtime },
		{
			...failuresFor(options, (request: Removal) => request.input),
			concurrent: true,
			onSuccess: (value, { input, inverse, sequence }) => {
				if (sequence === owner.sequence) {
					const undoInput = options.undoInput ? options.undoInput(value, input) : { ...input, ...inverse, expectedVersion: value.version };
					owner.registry.set(owner.notice, Option.some({ input, inverse: undoInput, message: options.describe(value, input), value }));
				}
			},
		},
	);
	const restoration = useActionState(
		{ run: undoRun, runtime: owner.runtime },
		{
			...failuresFor(options, (entry: Entry) => entry.inverse),
			onSuccess: (_value, entry) => {
				if (Option.getOrUndefined(owner.registry.get(owner.notice)) === entry) {
					owner.registry.set(owner.notice, Option.none());
				}
			},
		},
	);
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
