import type { Effect, Schema } from "effect";
import { useInsertionEffect, useMemo, useRef } from "react";
import type { Decoded, Fields } from "@shivaedev/effect-form/shape.ts";
import { type AtomServices, fieldRejectionOf, type RejectField } from "#fieldRejection.ts";

export function useSubmissionCallbacks<TFields extends Fields, A, E, R>(
	fields: Schema.Struct<TFields>,
	save: (values: Decoded<TFields>) => Effect.Effect<A, E, AtomServices<R>>,
	rejectField: RejectField<TFields, E> | undefined,
) {
	const latestRef = useRef({ rejectField, save });
	useInsertionEffect(() => {
		latestRef.current = { rejectField, save };
	}, [rejectField, save]);
	return useMemo(() => {
		const automatic = fieldRejectionOf(fields);
		return {
			rejectField: (error: E) => (latestRef.current.rejectField ?? automatic)(error),
			save: (values: Decoded<TFields>) => latestRef.current.save(values),
		};
	}, [fields]);
}
