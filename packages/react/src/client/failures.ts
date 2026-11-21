import type { AppRejection } from "@shivaedev/contract/failureKind.ts";
import type { FieldRejection } from "@shivaedev/form/fieldRejection.ts";
import type { Decoded, FieldFailure, Fields, Name } from "@shivaedev/form/shape.ts";
import type { NoticeDescriptor } from "#client/notices.ts";

type Tag<E> = E extends { readonly _tag: infer TTag extends string } ? TTag : never;
type Tagged<E, TTag> = Extract<E, { readonly _tag: TTag }>;

export type FailureChoice<TError, TInput, TOutcome> = "silent" | "message" | ((error: TError, input: TInput) => TOutcome | "silent");

export type FailureHandlers<E, TInput, TOutcome> = {
	readonly [TTag in Tag<E>]?: FailureChoice<Tagged<E, TTag>, TInput, TOutcome>;
};

export type Unhandled<E, TRouted = never> = Tag<Exclude<AppRejection<E>, TRouted>>;

// tsc prints this alias with the tags it still needs, so a missing handler is named in the error.
export type HandleAppRejections<TTags extends string, E, TInput, TOutcome> = {
	readonly [TTag in TTags]: FailureChoice<Tagged<E, TTag>, TInput, TOutcome>;
} & FailureHandlers<E, TInput, TOutcome>;

export type FailuresOption<E, TInput, TOutcome, TSilent extends boolean, TRouted = never> = { readonly silent?: TSilent } & (TSilent extends true
	? { readonly failures?: FailureHandlers<E, TInput, TOutcome> }
	: [Unhandled<E, TRouted>] extends [never]
		? { readonly failures?: FailureHandlers<E, TInput, TOutcome> }
		: { readonly failures: HandleAppRejections<Unhandled<E, TRouted>, E, TInput, TOutcome> });

export type FailuresChecked<E> = [Unhandled<E>] extends [never]
	? unknown
	: {
			readonly [TTag in Unhandled<E> as `failures.${TTag}`]: `the operation can fail with ${TTag}, a rejection the app declared: say what it shows, for example failures: { ${TTag}: "message" }`;
		};

export type FieldRouted<TFields, E> = E extends { readonly _tag: string; readonly field: infer TField extends string; readonly message: string }
	? string extends TField
		? never
		: [TField] extends [TFields]
			? E
			: never
	: never;

// A notice carries no `field`, so a handler that names a field the form lacks does not compile.
export type FormFailureOutcome<TDescriptor, TFields extends Fields> = (TDescriptor & { readonly field?: never }) | FieldRejection<Name<TFields>>;

export interface FailureChoices {
	readonly failures?: Readonly<Record<string, unknown>> | undefined;
	readonly silent?: boolean | undefined;
}

export type FormFailuresOption<TFields extends Fields, E, R, TSilent extends boolean> = FailuresOption<
	E,
	Decoded<TFields>,
	FormFailureOutcome<NoticeDescriptor<R>, TFields>,
	TSilent,
	FieldRouted<Name<TFields>, E> | FieldFailure
>;

export type QueryFailureHandlers<E> = FailureHandlers<E, void, NoticeDescriptor>;

export type QueryFailuresOption<E> = [Unhandled<E>] extends [never]
	? { readonly failures?: QueryFailureHandlers<E> }
	: { readonly failures: HandleAppRejections<Unhandled<E>, E, void, NoticeDescriptor> };

export type EditorQueryFailuresOption<TLoaded, E> = [TLoaded] extends [undefined]
	? { readonly queryFailures?: never }
	: [Unhandled<E>] extends [never]
		? { readonly queryFailures?: QueryFailureHandlers<E> }
		: { readonly queryFailures: HandleAppRejections<Unhandled<E>, E, void, NoticeDescriptor> };
