import { Effect, Option, type Schema } from "effect";
import { rejectedField } from "@shivaedev/errors/rejectedField.ts";
import type { FieldFailure, Fields, Name, Path, Submitter } from "#shape.ts";

export interface FieldRejection<TName extends string> {
	readonly field: TName | Path<TName>;
	readonly message: string;
}

export type RejectField<TFields extends Fields, TError> = (error: TError) => FieldRejection<Name<TFields>> | undefined;

export function fieldRejectionOf<TFields extends Fields>(schema: Schema.Struct<TFields>) {
	return (error: unknown): FieldRejection<Name<TFields>> | undefined => {
		function isName(name: string): name is Name<TFields> {
			return Object.hasOwn(schema.fields, name);
		}
		return Option.match(rejectedField(error), {
			onNone: () => undefined,
			onSome: ({ field, message }) => (isName(field) ? { field, message } : undefined),
		});
	};
}

export function rejecting<TFields extends Fields, TValues, TResult, TError, TRequirements>(
	schema: Schema.Struct<TFields>,
	save: (values: TValues) => Effect.Effect<TResult, TError, TRequirements>,
	reject: RejectField<TFields, TError> | undefined,
) {
	const rejection = reject ?? fieldRejectionOf(schema);
	return (values: TValues, submitter: Submitter<Name<TFields>>): Effect.Effect<TResult, TError | FieldFailure, TRequirements> =>
		Effect.catch(save(values), (error): Effect.Effect<never, TError | FieldFailure> => {
			const found = rejection(error);
			return found === undefined ? Effect.fail(error) : submitter.fail(found.field, found.message);
		});
}
