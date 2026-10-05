import type { Effect, Schema } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { make } from "@shivaedev/effect-form/form.ts";
import type { Decoded, Encoded, FieldFailure, Fields, Form, Services } from "@shivaedev/effect-form/shape.ts";
import { type AtomServices, type RejectField, rejecting } from "./field-rejection.ts";

export interface SubmissionConfig<F extends Fields, A, E, R, ER> {
	readonly fields: Schema.Struct<F>;
	readonly initialValues: Encoded<F>;
	readonly rejectField: RejectField<F, E> | undefined;
	readonly runtime: Atom.AtomRuntime<Services<F, R>, ER>;
	readonly save: (values: Decoded<F>) => Effect.Effect<A, E, AtomServices<R>>;
}

export interface Submission<F extends Fields, A, E, ER> {
	readonly form: Form<F, A, E | FieldFailure, ER>;
	readonly submitted: () => Encoded<F> | undefined;
}

export const submission = <F extends Fields, A, E, R, ER>(config: SubmissionConfig<F, A, E, R, ER>): Submission<F, A, E, ER> => {
	const { fields, initialValues, runtime } = config;
	const save = rejecting(fields, config.save, config.rejectField);
	let submitted: Encoded<F> | undefined;
	const form: Form<F, A, E | FieldFailure, ER> = make(fields, {
		initialValues,
		onSubmit: (values, submitter, snapshot) => {
			submitted = snapshot;
			return save(values, submitter);
		},
		runtime,
	});
	return { form, submitted: () => submitted };
};
