import type { Effect, Schema } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { form } from "@shivaedev/form/form.ts";
import type { PersistedDraftConfig } from "@shivaedev/form/persistence.ts";
import type { Decoded, Encoded, FieldFailure, Fields, Form, Services } from "@shivaedev/form/shape.ts";
import { actionTrace } from "#actionTrace.ts";
import { type AtomServices, type RejectField, rejecting } from "./fieldRejection.ts";

export interface SubmissionConfig<TFields extends Fields, A, E, R, TRuntimeError> {
	readonly fields: Schema.Struct<TFields>;
	readonly initialValues: Encoded<TFields>;
	readonly persistedDraft?: PersistedDraftConfig | undefined;
	readonly rejectField: RejectField<TFields, E> | undefined;
	readonly runtime: Atom.AtomRuntime<Services<TFields, R>, TRuntimeError>;
	readonly save: (values: Decoded<TFields>) => Effect.Effect<A, E, AtomServices<R>>;
}

export interface Submission<TFields extends Fields, A, E, TRuntimeError> {
	readonly form: Form<TFields, A, E | FieldFailure, TRuntimeError>;
	readonly submitted: () => Encoded<TFields> | undefined;
}

export function submission<TFields extends Fields, A, E, R, TRuntimeError>(
	config: SubmissionConfig<TFields, A, E, R, TRuntimeError>,
): Submission<TFields, A, E, TRuntimeError> {
	const { fields, initialValues, runtime } = config;
	const save = rejecting(fields, config.save, config.rejectField);
	let submitted: Encoded<TFields> | undefined;
	const currentForm: Form<TFields, A, E | FieldFailure, TRuntimeError> = form(fields, {
		initialValues,
		onSubmit: (values, submitter, snapshot) => {
			submitted = snapshot;
			return actionTrace(save(values, submitter), "ui.submit");
		},
		persistedDraft: config.persistedDraft,
		runtime,
	});
	return { form: currentForm, submitted: () => submitted };
}
