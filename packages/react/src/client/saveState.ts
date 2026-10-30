import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { type Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useCallback, useContext, useEffect } from "react";
import { FieldFailure, type Fields, type Form, Invalid } from "@shivaedev/form/shape.ts";
import { isUnauthorized } from "./resultState.ts";
import { useSessionRecheck } from "./sessionBoundary.ts";

const idle = Atom.make(AsyncResult.initial());
const clean = Atom.make(false);
export interface SaveState<E> {
	readonly cause: Option.Option<Cause.Cause<E | FieldFailure | Invalid>>;
	readonly dirty: boolean;
	readonly failure: Option.Option<E>;
	readonly revert: () => void;
	readonly save: () => void;
	readonly saving: boolean;
}
export function useSaveState<TFields extends Fields, A, E, TRuntimeError>(
	form: Form<TFields, A, E | FieldFailure, TRuntimeError> | undefined,
	settled: (result: A) => void,
): SaveState<E | TRuntimeError> {
	const registry = useContext(RegistryContext);
	const recheck = useSessionRecheck();
	const result: AsyncResult.AsyncResult<A, E | TRuntimeError | FieldFailure | Invalid> = useAtomValue(form?.submit ?? idle);
	const dirty = useAtomValue(form?.dirty ?? clean);
	useEffect(() => {
		if (AsyncResult.isFailure(result) && isUnauthorized(result.cause)) {
			recheck();
		}
	}, [recheck, result]);
	useEffect(
		() =>
			form
			&& registry.subscribe(form.submit, (next) => {
				if (AsyncResult.isSuccess(next) && !next.waiting) {
					settled(next.value);
				}
			}),
		[form, registry, settled],
	);
	const save = useCallback(() => {
		if (form === undefined || registry.get(form.submit).waiting) {
			return;
		}
		registry.set(form.submit, undefined);
	}, [form, registry]);
	const revert = useCallback(() => form?.revert(), [form]);
	const failure = Option.filter(
		AsyncResult.error(result),
		(error): error is E | TRuntimeError => !(error instanceof FieldFailure || error instanceof Invalid),
	);
	return { cause: AsyncResult.cause(result), dirty, failure, revert, save, saving: result.waiting };
}
