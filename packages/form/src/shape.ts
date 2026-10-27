import { Data, type Duration, type Effect, type Schema, type Scope } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRef from "effect/reactivity/AtomRef";
import type { AtomRegistry } from "effect/reactivity/AtomRegistry";
import type { Reactivity } from "effect/reactivity/Reactivity";
import type { FieldMessages } from "./messages.ts";
import type { PersistedDraftConfig } from "./persistence.ts";

export type Fields = Schema.Struct.Fields;

export type Encoded<TFields extends Fields> = Schema.Struct.Encoded<TFields>;

export type Decoded<TFields extends Fields> = Schema.Struct.Type<TFields>;

export type Name<TFields extends Fields> = keyof Encoded<TFields> & string;

export type Path<TName extends string = string> = readonly [TName, ...PropertyKey[]];

export type ArrayKeys<TFields extends Fields> = {
	readonly [TKey in Name<TFields>]?: NonNullable<Encoded<TFields>[TKey]> extends readonly (infer TElement)[]
		? (element: TElement) => PropertyKey
		: never;
};

export type Services<TFields extends Fields, R> = R | Schema.Struct.DecodingServices<TFields>;

export class FieldFailure extends Data.TaggedError("FieldFailure")<{
	readonly message: string;
	readonly path: string;
	readonly segments?: Path;
}> {}

export class Invalid extends Data.TaggedError("Invalid")<{
	readonly messages: FieldMessages;
}> {}

export interface Submitter<TName extends string> {
	readonly fail: (path: TName | Path<TName>, message: string) => Effect.Effect<never, FieldFailure>;
}

export type Checks<TFields extends Fields, R> = {
	readonly [TKey in Name<TFields>]?: (value: Encoded<TFields>[TKey]) => Effect.Effect<string | undefined, never, R>;
};

export interface Config<TFields extends Fields, A, E, R, TRuntimeError> {
	readonly arrayKeys?: ArrayKeys<TFields>;
	readonly checks?: Checks<TFields, R>;
	readonly debounce?: Duration.Input;
	readonly initialValues: Encoded<TFields>;
	readonly onSubmit: (
		values: Decoded<TFields>,
		submitter: Submitter<Name<TFields>>,
		submitted: Encoded<TFields>,
	) => Effect.Effect<A, E, R | Scope.Scope | AtomRegistry | Reactivity>;
	readonly persistedDraft?: PersistedDraftConfig | undefined;
	readonly runtime: Atom.AtomRuntime<Services<TFields, R>, TRuntimeError>;
}

export interface Form<TFields extends Fields, A, E, TRuntimeError> {
	readonly blur: (name: Name<TFields>) => void;
	readonly change: <TKey extends Name<TFields>>(name: TKey, value: Encoded<TFields>[TKey]) => void;
	readonly choices: <TKey extends Name<TFields>>(name: TKey) => readonly Encoded<TFields>[TKey][] | undefined;
	readonly dirty: Atom.Atom<boolean>;
	readonly error: (name: Name<TFields>) => Atom.Atom<string | undefined>;
	readonly errorAt: (path: Path<Name<TFields>>) => Atom.Atom<string | undefined>;
	readonly field: <TKey extends Name<TFields>>(name: TKey) => AtomRef.AtomRef<Encoded<TFields>[TKey]>;
	readonly receive: (values: Encoded<TFields>) => void;
	readonly revert: () => void;
	readonly submit: Atom.AtomResultFn<void, A, E | TRuntimeError | FieldFailure | Invalid>;
	readonly submitting: Atom.Atom<boolean>;
	readonly values: AtomRef.AtomRef<Encoded<TFields>>;
}

export type Holder = AtomRef.AtomRef<Readonly<Record<string, unknown>>>;

export function holder(values: object): Holder;
export function holder(values: object): unknown {
	return values;
}

export function fieldOf<TValue>(ref: AtomRef.AtomRef<unknown>): AtomRef.AtomRef<TValue>;
export function fieldOf(ref: AtomRef.AtomRef<unknown>): unknown {
	return ref;
}

export function choicesOf<TValue>(choices: readonly unknown[] | undefined): readonly TValue[] | undefined;
export function choicesOf(choices: readonly unknown[] | undefined): unknown {
	return choices;
}

export function checkOf<R>(check: unknown): (value: unknown) => Effect.Effect<string | undefined, never, R>;
export function checkOf(check: unknown): unknown {
	return check;
}
