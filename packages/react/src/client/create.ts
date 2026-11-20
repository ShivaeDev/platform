import { Equal, Option, type Schema } from "effect";
import { useCallback, useState } from "react";
import { usePersistedDraft } from "@shivaedev/form/adapters/react.ts";
import type { FieldRejectionMapping } from "@shivaedev/form/fieldRejection.ts";
import type { PersistedDraftConfig } from "@shivaedev/form/persistence.ts";
import type { Decoded, Encoded, FieldFailure, Fields, Form, Services } from "@shivaedev/form/shape.ts";
import { formFields } from "#client/adapters/formFields.ts";
import { typedCreate } from "#client/adapters/operationHooks.ts";
import { useSubmissionCallbacks } from "#client/adapters/useSubmissionCallbacks.ts";
import type { BoundOperation, LooseOperation } from "#client/boundOperation.ts";
import type { NoticeFeedback } from "#client/notices.ts";
import type { DecodingServicesOption, FieldsOption, FixedOption, FormFields, NoFixed, Unfixed } from "#client/operationForm.ts";
import { type SaveState, useSaveState } from "#client/saveState.ts";
import { type SubmissionConfig, submission } from "#submission.ts";
export type CreateOptions<TFields extends Fields, TCreated, TSaveError, R, TRuntimeError> = {
	readonly persistedDraft?: PersistedDraftConfig | undefined;
	readonly initialValues: Encoded<TFields>;
	readonly notices?: NoticeFeedback<Decoded<TFields>, TCreated, TSaveError, Services<TFields, R>>;
} & FieldRejectionMapping<TFields, TSaveError> &
	Pick<SubmissionConfig<TFields, TCreated, TSaveError, R, TRuntimeError>, "requiredMessages" | "checks" | "debounce" | "arrayKeys">;
export interface Create<TFields extends Fields, TCreated, TSaveError, TRuntimeError> extends SaveState<TSaveError | TRuntimeError> {
	readonly created: Option.Option<TCreated>;
	readonly form: Form<TFields, TCreated, TSaveError | FieldFailure, TRuntimeError>;
}
function resetValues<TV extends object>(baseline: TV, current: TV, submitted: TV | undefined): TV;
function resetValues(baseline: Readonly<Record<string, unknown>>, current: Readonly<Record<string, unknown>>, submitted = current): object {
	return Object.fromEntries(
		Object.keys({ ...baseline, ...current, ...submitted }).flatMap((name) => {
			const changed = Object.hasOwn(current, name) !== Object.hasOwn(submitted, name) || !Equal.equals(current[name], submitted[name]);
			const source = changed ? current : baseline;
			return Object.hasOwn(source, name) ? [[name, source[name]]] : [];
		}),
	);
}
export type UseCreate = <
	TInput,
	TCreated,
	TSaveError,
	R,
	TRuntimeError,
	TPayload = never,
	TFixed extends Partial<TInput> = NoFixed,
	TFields extends Fields = never,
>(
	operation: BoundOperation<TInput, TCreated, TSaveError, R, TRuntimeError> & { readonly payload?: TPayload },
	options: NoInfer<CreateOptions<FormFields<TPayload, TFixed, TFields>, TCreated, TSaveError, R, TRuntimeError>> &
		FieldsOption<TPayload, TFields> &
		FixedOption<TInput, TFixed, Unfixed<TInput, FormFields<TPayload, TFixed, TFields>, TFixed>> &
		NoInfer<DecodingServicesOption<FormFields<TPayload, TFixed, TFields>, R>>,
) => Create<FormFields<TPayload, TFixed, TFields>, TCreated, TSaveError, TRuntimeError>;
export type LooseCreate = (
	operation: LooseOperation,
	options: CreateOptions<Fields, unknown, unknown, unknown, unknown> & { readonly fields?: Schema.Struct<Fields>; readonly fixed?: object },
) => Create<Fields, unknown, unknown, unknown>;
const useLooseCreate: LooseCreate = (operation, options) => {
	const { fixed } = options;
	const { runtime } = operation;
	const fields = formFields(operation.payload, options.fields, fixed);
	const config = { ...options, fields, runtime };
	const persistedDraft = usePersistedDraft(config.persistedDraft);
	const callbacks = useSubmissionCallbacks(
		fields,
		(values: Decoded<Fields>) => operation.run({ ...fixed, ...values }),
		config.rejectField,
		runtime,
		config.notices,
	);
	function initialize() {
		const { initialValues } = config;
		function makeSubmission() {
			return submission({ ...config, ...callbacks, fields, initialValues, persistedDraft, runtime });
		}
		return { baseline: initialValues, created: Option.none<unknown>(), current: makeSubmission(), fields, fresh: makeSubmission, runtime };
	}
	const [held, hold] = useState(initialize);
	let entry = held;
	if (entry.fields !== fields || entry.runtime !== runtime) {
		entry = initialize();
		hold(entry);
	}
	const { baseline, created, current, fresh } = entry;
	const settled = useCallback(
		(value: unknown) => {
			const next = fresh();
			next.form.values.set(resetValues(baseline, current.form.values.value, current.submitted()));
			hold({ ...entry, created: Option.some(value), current: next });
		},
		[entry, current, fresh, baseline],
	);
	return { ...useSaveState(current.form, settled), created, form: current.form };
};
export const useCreate = typedCreate(useLooseCreate);
