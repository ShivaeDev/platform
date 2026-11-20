import { Cause, Effect, Option, type Schema } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { useInsertionEffect, useMemo, useRef } from "react";
import { fieldRejectionOf } from "@shivaedev/form/fieldRejection.ts";
import { type Decoded, FieldFailure, type Fields, type Name, type Submitter } from "@shivaedev/form/shape.ts";
import type { AtomServices } from "#AtomServices.ts";
import { useFeedback } from "#client/adapters/useFeedback.ts";
import type { Decision } from "#client/failureDecision.ts";
import type { FailureChoices } from "#client/failures.ts";
import type { NoticeFeedback } from "#client/notices.ts";

function isFieldFailure(cause: Cause.Cause<unknown>) {
	return Option.exists(Cause.findErrorOption(cause), (error) => error instanceof FieldFailure);
}

function placeOnField<TName extends string>(decision: Decision<unknown>, isName: (name: string) => name is TName, submitter: Submitter<TName>) {
	if (decision._tag !== "field") {
		return undefined;
	}
	const { field, message } = decision.rejection;
	const name = typeof field === "string" ? field : field[0];
	if (!isName(name)) {
		return undefined;
	}
	return submitter.fail(typeof field === "string" ? name : [name, ...field.slice(1)], message);
}

export function useSubmissionCallbacks<TFields extends Fields, A, E, R, TRuntime, TRuntimeError>(
	fields: Schema.Struct<TFields>,
	save: (values: Decoded<TFields>) => Effect.Effect<A, E, AtomServices<R>>,
	choices: FailureChoices,
	runtime: Atom.AtomRuntime<TRuntime, TRuntimeError>,
	notices: NoticeFeedback<Decoded<TFields>, A, TRuntime> | undefined,
) {
	const feedback = useFeedback(runtime);
	const latestRef = useRef({ choices, notices, save });
	useInsertionEffect(() => {
		latestRef.current = { choices, notices, save };
	}, [choices, notices, save]);
	const callbacks = useMemo(() => {
		const automatic = fieldRejectionOf(fields);
		function isName(field: string): field is Name<TFields> {
			return Object.hasOwn(fields.fields, field);
		}
		function rejected(cause: Cause.Cause<E>, values: Decoded<TFields>, submitter: Submitter<Name<TFields>>) {
			return Effect.suspend((): Effect.Effect<never, E | FieldFailure> => {
				// A save that already answered with a field failure has placed its own feedback.
				if (!callbacks.active || isFieldFailure(cause)) {
					return Effect.failCause(cause);
				}
				const decision = feedback.failed(cause, values, latestRef.current.choices, automatic);
				return placeOnField(decision, isName, submitter) ?? Effect.failCause(cause);
			});
		}
		function completed(value: A, values: Decoded<TFields>) {
			return Effect.sync(() => {
				if (callbacks.active) {
					feedback.succeeded(latestRef.current.notices?.onSuccess?.(value, values));
				}
				return value;
			});
		}
		return {
			active: false,
			save: (values: Decoded<TFields>, submitter: Submitter<Name<TFields>>): Effect.Effect<A, E | FieldFailure, AtomServices<R>> =>
				Effect.suspend(() => latestRef.current.save(values)).pipe(
					Effect.matchCauseEffect({
						onFailure: (cause) => rejected(cause, values, submitter),
						onSuccess: (value) => completed(value, values),
					}),
				),
		};
	}, [feedback, fields]);
	useInsertionEffect(() => {
		callbacks.active = true;
		return () => {
			callbacks.active = false;
		};
	}, [callbacks]);
	return callbacks;
}
