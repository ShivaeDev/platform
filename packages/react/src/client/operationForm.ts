import type { Schema } from "effect";
import type { Decoded, Encoded, Fields } from "@shivaedev/form/shape.ts";

export type NoFixed = Record<never, never>;

type FieldsWithout<TPayload, TFixedKey> =
	TPayload extends Schema.Struct<infer TPayloadFields>
		? { readonly [TKey in keyof TPayloadFields as TKey extends TFixedKey ? never : TKey]: TPayloadFields[TKey] }
		: never;

export type FormFields<TPayload, TFixed, TFields extends Fields> = [TFields] extends [never]
	? Extract<FieldsWithout<TPayload, keyof TFixed>, Fields>
	: TFields;

export type FieldsOption<TPayload, TFields extends Fields> = [TPayload] extends [Schema.Struct<infer _Fields>]
	? { readonly fields?: Schema.Struct<TFields> }
	: { readonly fields: Schema.Struct<TFields> };

type FixedValues<TInput, TFixed, TRequired> = {
	readonly [TKey in keyof TFixed]: TKey extends keyof TInput ? TInput[TKey] : "is not a field of the command's payload";
} & { readonly [TKey in Extract<TRequired, keyof TInput>]: TInput[TKey] };

// `fixed` and the form's fields together give the command its whole payload, so a key missing from both or foreign to the payload fails to compile.
export type FixedOption<TInput, TFixed, TRequired> = [TRequired] extends [never]
	? { readonly fixed?: TFixed & FixedValues<TInput, TFixed, never> }
	: { readonly fixed: TFixed & FixedValues<TInput, TFixed, TRequired> };

export type Unfixed<TInput, TFields extends Fields, TFixed> = Exclude<keyof TInput, keyof Decoded<TFields> | keyof TFixed>;

export type DecodingServicesOption<TFields extends Fields, R> = [Exclude<Schema.Struct.DecodingServices<TFields>, R>] extends [never]
	? unknown
	: { readonly "the operation's runtime must provide the services its form fields decode with": Exclude<Schema.Struct.DecodingServices<TFields>, R> };

type Shared<TRow, TFields extends Fields> = keyof Decoded<TFields> & keyof TRow;

export type MissingFromRow<TRow, TFields extends Fields> = Exclude<keyof Decoded<TFields>, keyof TRow>;

type RowMatches<TRow, TFields extends Fields> = [Pick<TRow, Shared<TRow, TFields>>] extends [Pick<Decoded<TFields>, Shared<TRow, TFields>>]
	? [Schema.Struct.EncodingServices<TFields>] extends [never]
		? true
		: false
	: false;

// Without `values`, each form value is the row's value of the same name, encoded by its field; a row that cannot supply them needs `values`.
export type ValuesOption<TRow, TFields extends Fields, TDerived extends boolean> =
	RowMatches<TRow, TFields> extends true
		? TDerived extends true
			? { readonly values?: (row: TRow) => Encoded<TFields> }
			: [MissingFromRow<TRow, TFields>] extends [never]
				? { readonly values?: (row: TRow) => Encoded<TFields> }
				: { readonly values: (row: TRow) => Encoded<TFields> }
		: { readonly values: (row: TRow) => Encoded<TFields> };
