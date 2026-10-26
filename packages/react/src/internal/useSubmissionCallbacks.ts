import { Effect, type Schema } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { useInsertionEffect, useMemo, useRef } from "react";
import type { Decoded, Fields } from "@shivaedev/form/shape.ts";
import { type AtomServices, fieldRejectionOf, type RejectField } from "#fieldRejection.ts";
import type { NoticeFeedback } from "#notices.ts";
import { useNoticePublisher } from "./useNoticePublisher.ts";

export function useSubmissionCallbacks<TFields extends Fields, A, E, R, TRuntime, TRuntimeError>(
	fields: Schema.Struct<TFields>,
	save: (values: Decoded<TFields>) => Effect.Effect<A, E, AtomServices<R>>,
	rejectField: RejectField<TFields, E> | undefined,
	runtime: Atom.AtomRuntime<TRuntime, TRuntimeError>,
	notices: NoticeFeedback<Decoded<TFields>, A, E, TRuntime> | undefined,
) {
	const publish = useNoticePublisher(runtime);
	const latestRef = useRef({ notices, rejectField, save });
	useInsertionEffect(() => {
		latestRef.current = { notices, rejectField, save };
	}, [notices, rejectField, save]);
	const callbacks = useMemo(() => {
		const automatic = fieldRejectionOf(fields);
		function rejected(error: E, values: Decoded<TFields>) {
			return Effect.sync(() => {
				if (callbacks.active) {
					publish(latestRef.current.notices?.onFailure?.(error, values));
				}
			}).pipe(Effect.andThen(Effect.fail(error)));
		}
		function completed(value: A, values: Decoded<TFields>) {
			return Effect.sync(() => {
				if (callbacks.active) {
					publish(latestRef.current.notices?.onSuccess?.(value, values));
				}
				return value;
			});
		}
		return {
			active: false,
			rejectField: (error: E) => (latestRef.current.rejectField ?? automatic)(error),
			save: (values: Decoded<TFields>): Effect.Effect<A, E, AtomServices<R>> =>
				Effect.suspend(() => latestRef.current.save(values)).pipe(
					Effect.matchEffect({
						onFailure: (error) => rejected(error, values),
						onSuccess: (value) => completed(value, values),
					}),
				),
		};
	}, [fields, publish]);
	useInsertionEffect(() => {
		callbacks.active = true;
		return () => {
			callbacks.active = false;
		};
	}, [callbacks]);
	return callbacks;
}
