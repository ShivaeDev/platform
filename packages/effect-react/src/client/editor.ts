import { type Effect, Option, type Schema } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useCallback, useEffect, useState } from "react";
import { type BrowserDraftConfig, usePersistedDraft } from "@shivaedev/effect-form/react.ts";
import type { Decoded, Encoded, FieldFailure, Fields, Form, Services } from "@shivaedev/effect-form/shape.ts";
import type { AtomServices, FieldRejectionMapping } from "#field-rejection.ts";
import { submission } from "#submission.ts";
import { type QueryState, useQuery } from "./resultState.ts";
import { type SaveState, useSaveState } from "./saveState.ts";
export type EditorConfig<TFields extends Fields, TRow, TQueryError, TSaveError, R, TRuntimeError> = {
	readonly persistedDraft?: BrowserDraftConfig | undefined;
	readonly query: Atom.Atom<AsyncResult.AsyncResult<TRow, TQueryError>>;
	readonly fields: Schema.Struct<TFields>;
	readonly values: (row: TRow) => Encoded<TFields>;
	readonly save: (values: Decoded<TFields>) => Effect.Effect<TRow, TSaveError, AtomServices<R>>;
	readonly runtime: Atom.AtomRuntime<Services<TFields, R>, TRuntimeError>;
} & FieldRejectionMapping<TFields, TSaveError>;
export interface Editor<TFields extends Fields, TRow, TQueryError, TSaveError, TRuntimeError> extends SaveState<TSaveError | TRuntimeError> {
	readonly form: Form<TFields, TRow, TSaveError | FieldFailure, TRuntimeError> | undefined;
	readonly query: QueryState<TRow, TQueryError>;
}
interface Held<TFields extends Fields, TRow, TSaveError, TRuntimeError> {
	readonly form: Form<TFields, TRow, TSaveError | FieldFailure, TRuntimeError>;
	readonly query: Atom.Atom<unknown>;
	readonly values: (row: TRow) => Encoded<TFields>;
}
export function useEditor<TFields extends Fields, TRow, TQueryError, TSaveError, R, TRuntimeError>(
	config: EditorConfig<TFields, TRow, TQueryError, TSaveError, R, TRuntimeError>,
): Editor<TFields, TRow, TQueryError, TSaveError, TRuntimeError> {
	const persistedDraft = usePersistedDraft(config.persistedDraft);
	const query = useQuery(config.query);
	const row = Option.getOrUndefined(query.data);
	const [held, hold] = useState<Held<TFields, TRow, TSaveError, TRuntimeError> | undefined>(undefined);
	let current = held?.query === config.query ? held : undefined;
	if (current === undefined && row !== undefined) {
		current = {
			form: submission({
				fields: config.fields,
				initialValues: config.values(row),
				persistedDraft,
				rejectField: config.rejectField,
				runtime: config.runtime,
				save: config.save,
			}).form,
			query: config.query,
			values: config.values,
		};
		hold(current);
	}
	const form = current?.form;
	const values = current?.values;
	useEffect(() => {
		if (form && values && row !== undefined) {
			form.receive(values(row));
		}
	}, [form, values, row]);
	const settled = useCallback((saved: TRow) => (form && values ? form.receive(values(saved)) : undefined), [form, values]);
	return { ...useSaveState(form, settled), form, query };
}
