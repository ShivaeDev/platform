import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { FieldFailure, type Fields, type Form, Invalid } from "@shivaedev/effect-form";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useContext, useEffect } from "react";
import { isUnauthorized } from "./result-state.ts";
import { useSessionRecheck } from "./session-boundary.ts";

const idle = Atom.make(AsyncResult.initial());
const clean = Atom.make(false);

export interface SaveState<E> {
	readonly dirty: boolean;
	readonly failure: Option.Option<E>;
	readonly revert: () => void;
	readonly save: () => void;
	readonly saving: boolean;
}

export const useSaveState = <F extends Fields, A, E, ER>(
	form: Form<F, A, E | FieldFailure, ER> | undefined,
	settled: (result: A) => void,
): SaveState<E | ER> => {
	const registry = useContext(RegistryContext);
	const recheck = useSessionRecheck();
	const result: AsyncResult.AsyncResult<A, E | ER | FieldFailure | Invalid> = useAtomValue(form?.submit ?? idle);
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
	const failure = Option.filter(AsyncResult.error(result), (error): error is E | ER => !(error instanceof FieldFailure || error instanceof Invalid));
	return { dirty, failure, revert, save, saving: result.waiting };
};
