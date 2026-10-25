import { type Effect, Option, type Schema } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useCallback, useEffect, useState } from "react";
import { type BrowserDraftConfig, usePersistedDraft } from "@shivaedev/effect-form/client/react.ts";
import type { Decoded, Encoded, FieldFailure, Fields, Form, Services } from "@shivaedev/effect-form/shape.ts";
import type { AtomServices, FieldRejectionMapping } from "#fieldRejection.ts";
import { loadedQuery } from "#internal/loadedQuery.ts";
import { useSubmissionCallbacks } from "#internal/useSubmissionCallbacks.ts";
import type { NoticeFeedback } from "#notices.ts";
import { submission } from "#submission.ts";
import { type QueryOptions, type QueryState, useQuery } from "./resultState.ts";
import { type SaveState, useSaveState } from "./saveState.ts";
import type { LoadedQueryState } from "./useLoaderQuery.ts";
export type EditorConfig<TFields extends Fields, TRow, TQueryError, TSaveError, R, TRuntimeError> = {
	readonly persistedDraft?: BrowserDraftConfig | undefined;
	readonly query: Atom.Atom<AsyncResult.AsyncResult<TRow, TQueryError>>;
	readonly fields: Schema.Struct<TFields>;
	readonly values: (row: TRow) => Encoded<TFields>;
	readonly save: (values: Decoded<TFields>) => Effect.Effect<TRow, TSaveError, AtomServices<R>>;
	readonly runtime: Atom.AtomRuntime<Services<TFields, R>, TRuntimeError>;
	readonly notices?: NoticeFeedback<Decoded<TFields>, TRow, TSaveError, Services<TFields, R>>;
	readonly queryNotice?: QueryOptions<TQueryError>["notice"];
} & FieldRejectionMapping<TFields, TSaveError>;
export interface Editor<TFields extends Fields, TRow, TQueryError, TSaveError, TRuntimeError> extends SaveState<TSaveError | TRuntimeError> {
	readonly form: Form<TFields, TRow, TSaveError | FieldFailure, TRuntimeError> | undefined;
	readonly query: QueryState<TRow, TQueryError>;
}
export interface LoadedEditor<TFields extends Fields, TRow, TQueryError, TSaveError, TRuntimeError>
	extends Omit<Editor<TFields, TRow, TQueryError, TSaveError, TRuntimeError>, "form" | "query"> {
	readonly form: Form<TFields, TRow, TSaveError | FieldFailure, TRuntimeError>;
	readonly query: LoadedQueryState<TRow, TQueryError>;
}
interface Held<TFields extends Fields, TRow, TSaveError, R, TRuntimeError> {
	readonly fields: Schema.Struct<TFields>;
	readonly form: Form<TFields, TRow, TSaveError | FieldFailure, TRuntimeError>;
	readonly query: Atom.Atom<unknown>;
	readonly runtime: Atom.AtomRuntime<Services<TFields, R>, TRuntimeError>;
	readonly values: (row: TRow) => Encoded<TFields>;
}
export function useEditor<TFields extends Fields, TRow, TQueryError, TSaveError, R, TRuntimeError>(
	config: EditorConfig<TFields, TRow, TQueryError, TSaveError, R, TRuntimeError> & { readonly loaded: TRow },
): LoadedEditor<TFields, TRow, TQueryError, TSaveError, TRuntimeError>;
export function useEditor<TFields extends Fields, TRow, TQueryError, TSaveError, R, TRuntimeError>(
	config: EditorConfig<TFields, TRow, TQueryError, TSaveError, R, TRuntimeError>,
): Editor<TFields, TRow, TQueryError, TSaveError, TRuntimeError>;
export function useEditor<TFields extends Fields, TRow, TQueryError, TSaveError, R, TRuntimeError>(
	config: EditorConfig<TFields, TRow, TQueryError, TSaveError, R, TRuntimeError> & { readonly loaded?: TRow },
): Editor<TFields, TRow, TQueryError, TSaveError, TRuntimeError> | LoadedEditor<TFields, TRow, TQueryError, TSaveError, TRuntimeError> {
	const persistedDraft = usePersistedDraft(config.persistedDraft);
	const callbacks = useSubmissionCallbacks(config.fields, config.save, config.rejectField, config.runtime, config.notices);
	const query = useQuery(config.query, config.queryNotice === undefined ? {} : { notice: config.queryNotice });
	const row = Option.orElse(query.data, () => ("loaded" in config ? Option.some(config.loaded) : Option.none()));
	const [held, hold] = useState<Held<TFields, TRow, TSaveError, R, TRuntimeError> | undefined>(undefined);
	let current = held?.query === config.query && held.fields === config.fields && held.runtime === config.runtime ? held : undefined;
	if (current === undefined && Option.isSome(row)) {
		current = {
			fields: config.fields,
			form: submission({
				...callbacks,
				fields: config.fields,
				initialValues: config.values(row.value),
				persistedDraft,
				runtime: config.runtime,
			}).form,
			query: config.query,
			runtime: config.runtime,
			values: config.values,
		};
		hold(current);
	}
	const form = current?.form;
	const values = current?.values;
	const received = Option.getOrUndefined(row);
	useEffect(() => {
		if (form && values && received !== undefined) {
			form.receive(values(received));
		}
	}, [form, values, received]);
	const settled = useCallback((saved: TRow) => (form && values ? form.receive(values(saved)) : undefined), [form, values]);
	const saveState = useSaveState(form, settled);
	if ("loaded" in config) {
		if (!form) {
			throw new Error("A loaded editor requires a row");
		}
		return { ...saveState, form, query: loadedQuery(query, config.loaded) };
	}
	return { ...saveState, form, query };
}
