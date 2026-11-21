import { Option, type Schema } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useEffect, useState } from "react";
import type { PersistedDraftConfig } from "@shivaedev/form/persistence.ts";
import { usePersistedDraft } from "@shivaedev/form/react.ts";
import type { Decoded, Encoded, FieldFailure, Fields, Form, Services } from "@shivaedev/form/shape.ts";
import { formFields } from "#client/adapters/formFields.ts";
import { typedEditor } from "#client/adapters/operationHooks.ts";
import { rowValues } from "#client/adapters/rowValues.ts";
import type { BoundOperation, LooseOperation } from "#client/boundOperation.ts";
import type { EditorQueryFailuresOption, FailureChoices, FormFailuresOption } from "#client/failures.ts";
import type { NoticeFeedback } from "#client/notices.ts";
import type {
	DecodingServicesOption,
	FieldsOption,
	FixedOption,
	FormFields,
	MissingFromRow,
	NoFixed,
	Unfixed,
	ValuesOption,
} from "#client/operationForm.ts";
import type { QueryState } from "#client/resultState.ts";
import { type SaveState, useSaveState } from "#client/saveState.ts";
import { useEditorQuery } from "#client/useEditorQuery.ts";
import type { LoadedQueryState } from "#client/useLoaderQuery.ts";
import { useSubmissionCallbacks } from "#client/useSubmissionCallbacks.ts";
import { loadedQuery } from "#loadedQuery.ts";
import { type SubmissionConfig, submission } from "#submission.ts";
export type EditorOptions<TFields extends Fields, TRow, TQueryError, TSaved, TSaveError, R, TRuntimeError> = {
	readonly persistedDraft?: PersistedDraftConfig | undefined;
	readonly query: Atom.Atom<AsyncResult.AsyncResult<TRow, TQueryError>>;
	readonly notices?: NoticeFeedback<Decoded<TFields>, TSaved, Services<TFields, R>>;
} & Pick<SubmissionConfig<TFields, TSaved, TSaveError, R, TRuntimeError>, "requiredMessages" | "checks" | "debounce" | "arrayKeys">;
export interface Editor<TFields extends Fields, TRow, TQueryError, TSaveError, TRuntimeError, TSaved = TRow>
	extends SaveState<TSaveError | TRuntimeError> {
	readonly form: Form<TFields, TSaved, TSaveError | FieldFailure, TRuntimeError> | undefined;
	readonly query: QueryState<TRow, TQueryError>;
}
export interface LoadedEditor<TFields extends Fields, TRow, TQueryError, TSaveError, TRuntimeError, TSaved = TRow>
	extends Omit<Editor<TFields, TRow, TQueryError, TSaveError, TRuntimeError, TSaved>, "form" | "query"> {
	readonly form: Form<TFields, TSaved, TSaveError | FieldFailure, TRuntimeError>;
	readonly query: LoadedQueryState<TRow, TQueryError>;
}
type Derived<TFields> = [TFields] extends [never] ? true : false;
interface Held {
	readonly fields: Schema.Struct<Fields>;
	readonly form: Form<Fields, unknown, unknown, unknown>;
	readonly query: Atom.Atom<unknown>;
	readonly runtime: Atom.AtomRuntime<unknown, unknown>;
	readonly values: (row: unknown) => Encoded<Fields>;
}
// The command's success must be a row the form can read back, so `values` (or the derived values) reads both the query's row and the saved result.
export type UseEditor = <
	TInput,
	TSaved,
	TSaveError,
	R,
	TRuntimeError,
	TRow,
	TQueryError,
	TPayload = never,
	TFixed extends Partial<TInput> = NoFixed,
	TFields extends Fields = never,
	TLoaded extends NoInfer<TRow> | undefined = undefined,
	TSilent extends boolean = false,
>(
	operation: BoundOperation<TInput, TSaved, TSaveError, R, TRuntimeError> & { readonly payload?: TPayload },
	options: EditorOptions<
		NoInfer<FormFields<TPayload, TFixed, TFields>>,
		TRow,
		TQueryError,
		NoInfer<TSaved>,
		NoInfer<TSaveError>,
		NoInfer<R>,
		NoInfer<TRuntimeError>
	> & {
		readonly loaded?: TLoaded;
	} & FieldsOption<TPayload, TFields> &
		FixedOption<
			TInput,
			TFixed,
			| Unfixed<TInput, FormFields<TPayload, TFixed, TFields>, TFixed>
			| (Derived<TFields> extends true ? MissingFromRow<TRow | TSaved, FormFields<TPayload, TFixed, TFields>> : never)
		> &
		NoInfer<ValuesOption<TRow | TSaved, FormFields<TPayload, TFixed, TFields>, Derived<TFields>>> &
		NoInfer<DecodingServicesOption<FormFields<TPayload, TFixed, TFields>, R>> &
		NoInfer<EditorQueryFailuresOption<TLoaded, TQueryError>> &
		FormFailuresOption<FormFields<TPayload, TFixed, TFields>, TSaveError, Services<FormFields<TPayload, TFixed, TFields>, R>, TSilent>,
) => [TLoaded] extends [undefined]
	? Editor<FormFields<TPayload, TFixed, TFields>, TRow, TQueryError, TSaveError, TRuntimeError, TSaved>
	: LoadedEditor<FormFields<TPayload, TFixed, TFields>, TRow, TQueryError, TSaveError, TRuntimeError, TSaved>;
export type LooseEditor = (
	operation: LooseOperation,
	options: EditorOptions<Fields, unknown, unknown, unknown, unknown, unknown, unknown> &
		FailureChoices & {
			readonly fields?: Schema.Struct<Fields>;
			readonly fixed?: object;
			readonly loaded?: unknown;
			readonly queryFailures?: FailureChoices["failures"];
			readonly values?: (row: unknown) => Encoded<Fields>;
		},
) => Editor<Fields, unknown, unknown, unknown, unknown, unknown> | LoadedEditor<Fields, unknown, unknown, unknown, unknown, unknown>;
const useLooseEditor: LooseEditor = (operation, options) => {
	const { fixed } = options;
	const { runtime } = operation;
	const fields = formFields(operation.payload, options.fields, fixed);
	const config = { ...options, fields, runtime, values: options.values ?? rowValues(fields) };
	const persistedDraft = usePersistedDraft(config.persistedDraft);
	const callbacks = useSubmissionCallbacks(
		fields,
		(edited: Decoded<Fields>) => operation.run({ ...fixed, ...edited }),
		config,
		runtime,
		config.notices,
	);
	const { query, row } = useEditorQuery(config);
	const [held, hold] = useState<Held | undefined>(undefined);
	let current = held?.query === config.query && held.fields === fields && held.runtime === runtime ? held : undefined;
	if (current === undefined && Option.isSome(row)) {
		current = {
			fields,
			form: submission({
				...config,
				...callbacks,
				initialValues: config.values(row.value),
				persistedDraft,
				savedValues: config.values,
			}).form,
			query: config.query,
			runtime,
			values: config.values,
		};
		hold(current);
	}
	const { form, values } = current ?? { form: undefined, values: undefined };
	const received = Option.getOrUndefined(row);
	useEffect(() => {
		if (form && values && received !== undefined) {
			form.receive(values(received));
		}
	}, [form, values, received]);
	const saveState = useSaveState(form);
	if ("loaded" in config && form !== undefined) {
		return { ...saveState, form, query: loadedQuery(query, config.loaded) };
	}
	return { ...saveState, form, query };
};
export const useEditor = typedEditor(useLooseEditor);
