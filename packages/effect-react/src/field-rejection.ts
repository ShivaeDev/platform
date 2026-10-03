import type { FieldFailure, Fields, Name, Submitter } from "@shivaedev/effect-form";
import { Effect, Predicate, type Schema, type Scope } from "effect";
import type { AtomRegistry } from "effect/unstable/reactivity/AtomRegistry";
import type { Reactivity } from "effect/unstable/reactivity/Reactivity";

export interface FieldRejection<N extends string> {
	readonly field: N;
	readonly message: string;
}

export type AtomServices<R> = R | Scope.Scope | AtomRegistry | Reactivity;

export type RejectField<F extends Fields, E> = (error: E) => FieldRejection<Name<F>> | undefined;

type Unmatched<F extends Fields, E> = E extends { readonly _tag: string; readonly message: string }
	? "field" extends keyof E
		? Exclude<E["field"], Name<F> | undefined>
		: never
	: never;

export type FieldRejectionMapping<F extends Fields, E> = { readonly rejectField?: RejectField<F, E> } & ([Unmatched<F, E>] extends [never]
	? unknown
	: { readonly rejectField: RejectField<F, E> });

export const fieldRejectionOf =
	<F extends Fields>(schema: Schema.Struct<F>) =>
	(error: unknown): FieldRejection<Name<F>> | undefined => {
		const isName = (name: unknown): name is Name<F> => typeof name === "string" && Object.hasOwn(schema.fields, name);
		if (!(Predicate.hasProperty(error, "_tag") && Predicate.hasProperty(error, "field") && Predicate.hasProperty(error, "message"))) {
			return undefined;
		}
		const { _tag, field, message } = error;
		return typeof _tag === "string" && isName(field) && typeof message === "string" ? { field, message } : undefined;
	};

export const rejecting = <F extends Fields, V, A, E, R>(
	schema: Schema.Struct<F>,
	save: (values: V) => Effect.Effect<A, E, R>,
	reject: RejectField<F, E> | undefined,
) => {
	const rejection = reject ?? fieldRejectionOf(schema);
	return (values: V, submitter: Submitter<Name<F>>): Effect.Effect<A, E | FieldFailure, R> =>
		Effect.catch(save(values), (error): Effect.Effect<never, E | FieldFailure> => {
			const found = rejection(error);
			return found === undefined ? Effect.fail(error) : submitter.fail(found.field, found.message);
		});
};
