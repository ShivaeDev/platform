import { Effect, Predicate, type Schema, type Scope } from "effect";
import type { AtomRegistry } from "effect/reactivity/AtomRegistry";
import type { Reactivity } from "effect/reactivity/Reactivity";
import type { FieldFailure, Fields, Name, Submitter } from "@shivaedev/form/shape.ts";

export interface FieldRejection<TName extends string> {
	readonly field: TName;
	readonly message: string;
}

export type AtomServices<TRequirements> = TRequirements | Scope.Scope | AtomRegistry | Reactivity;

export type RejectField<TFields extends Fields, TError> = (error: TError) => FieldRejection<Name<TFields>> | undefined;

type Unmatched<TFields extends Fields, TError> = TError extends { readonly _tag: string; readonly message: string }
	? "field" extends keyof TError
		? Exclude<TError["field"], Name<TFields> | undefined>
		: never
	: never;

export type FieldRejectionMapping<TFields extends Fields, TError> = { readonly rejectField?: RejectField<TFields, TError> } & ([
	Unmatched<TFields, TError>,
] extends [never]
	? unknown
	: { readonly rejectField: RejectField<TFields, TError> });

export function fieldRejectionOf<TFields extends Fields>(schema: Schema.Struct<TFields>) {
	return (error: unknown): FieldRejection<Name<TFields>> | undefined => {
		function isName(name: unknown): name is Name<TFields> {
			return typeof name === "string" && Object.hasOwn(schema.fields, name);
		}
		if (!(Predicate.hasProperty(error, "_tag") && Predicate.hasProperty(error, "field") && Predicate.hasProperty(error, "message"))) {
			return undefined;
		}
		const { _tag, field, message } = error;
		return typeof _tag === "string" && isName(field) && typeof message === "string" ? { field, message } : undefined;
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
