import { type Effect, Equal, Option, type Schema } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useState } from "react";
import type { Decoded, Encoded, FieldFailure, Fields, Form, Services } from "@shivaedev/effect-form/shape.ts";
import type { AtomServices, FieldRejectionMapping } from "./field-rejection.ts";
import { type SaveState, useSaveState } from "./save-state.ts";
import { submission } from "./submission.ts";

export type CreateConfig<F extends Fields, Created, SE, R, ER> = {
	readonly fields: Schema.Struct<F>;
	readonly initialValues: Encoded<F>;
	readonly create: (values: Decoded<F>) => Effect.Effect<Created, SE, AtomServices<R>>;
	readonly runtime: Atom.AtomRuntime<Services<F, R>, ER>;
} & FieldRejectionMapping<F, SE>;

export interface Create<F extends Fields, Created, SE, ER> extends SaveState<SE | ER> {
	readonly created: Option.Option<Created>;
	readonly form: Form<F, Created, SE | FieldFailure, ER>;
}

function editedSince<V extends object>(current: V, submitted: V | undefined): Readonly<Record<string, unknown>> {
	const before = new Map(Object.entries(submitted ?? current));
	return Object.fromEntries(Object.entries(current).filter(([name, value]) => !Equal.equals(value, before.get(name))));
}

export const useCreate = <F extends Fields, Created, SE, R, ER>(config: CreateConfig<F, Created, SE, R, ER>): Create<F, Created, SE, ER> => {
	const [{ initialValues, fresh }] = useState(() => {
		const { fields, initialValues, runtime, create, rejectField } = config;
		return { fresh: () => submission({ fields, initialValues, rejectField, runtime, save: create }), initialValues };
	});
	const [current, replace] = useState(fresh);
	const [created, record] = useState<Option.Option<Created>>(Option.none());
	const settled = useCallback(
		(value: Created) => {
			const next = fresh();
			next.form.values.set({ ...initialValues, ...editedSince(current.form.values.value, current.submitted()) });
			record(Option.some(value));
			replace(next);
		},
		[current, fresh, initialValues],
	);
	return { ...useSaveState(current.form, settled), created, form: current.form };
};
