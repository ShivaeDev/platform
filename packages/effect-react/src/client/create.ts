import { type Effect, Equal, Option, type Schema } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useState } from "react";
import type { Decoded, Encoded, FieldFailure, Fields, Form, Services } from "@shivaedev/effect-form/shape.ts";
import type { AtomServices, FieldRejectionMapping } from "#field-rejection.ts";
import { submission } from "#submission.ts";
import { type SaveState, useSaveState } from "./saveState.ts";
export type CreateConfig<TFields extends Fields, TCreated, TSaveError, R, TRuntimeError> = {
	readonly fields: Schema.Struct<TFields>;
	readonly initialValues: Encoded<TFields>;
	readonly create: (values: Decoded<TFields>) => Effect.Effect<TCreated, TSaveError, AtomServices<R>>;
	readonly runtime: Atom.AtomRuntime<Services<TFields, R>, TRuntimeError>;
} & FieldRejectionMapping<TFields, TSaveError>;
export interface Create<TFields extends Fields, TCreated, TSaveError, TRuntimeError> extends SaveState<TSaveError | TRuntimeError> {
	readonly created: Option.Option<TCreated>;
	readonly form: Form<TFields, TCreated, TSaveError | FieldFailure, TRuntimeError>;
}
function editedSince<TV extends object>(current: TV, submitted: TV | undefined): Readonly<Record<string, unknown>> {
	const before = new Map(Object.entries(submitted ?? current));
	return Object.fromEntries(Object.entries(current).filter(([name, value]) => !Equal.equals(value, before.get(name))));
}
export function useCreate<TFields extends Fields, TCreated, TSaveError, R, TRuntimeError>(
	config: CreateConfig<TFields, TCreated, TSaveError, R, TRuntimeError>,
): Create<TFields, TCreated, TSaveError, TRuntimeError> {
	const [{ initialValues: baseline, fresh }] = useState(() => {
		const { fields, initialValues, runtime, create, rejectField } = config;
		return { fresh: () => submission({ fields, initialValues, rejectField, runtime, save: create }), initialValues };
	});
	const [current, replace] = useState(fresh);
	const [created, record] = useState<Option.Option<TCreated>>(Option.none());
	const settled = useCallback(
		(value: TCreated) => {
			const next = fresh();
			next.form.values.set({ ...baseline, ...editedSince(current.form.values.value, current.submitted()) });
			record(Option.some(value));
			replace(next);
		},
		[current, fresh, baseline],
	);
	return { ...useSaveState(current.form, settled), created, form: current.form };
}
