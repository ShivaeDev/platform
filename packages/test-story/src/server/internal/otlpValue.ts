import { Schema } from "effect";

export interface OtlpValue {
	readonly arrayValue?: { readonly values?: readonly OtlpValue[] };
	readonly boolValue?: boolean;
	readonly bytesValue?: string;
	readonly doubleValue?: number;
	readonly intValue?: string;
	readonly kvlistValue?: { readonly values?: readonly { readonly key: string; readonly value: OtlpValue }[] };
	readonly stringValue?: string;
}

const OtlpValue: Schema.Codec<OtlpValue> = Schema.suspend(() =>
	Schema.Struct({
		arrayValue: Schema.optionalKey(Schema.Struct({ values: Schema.optionalKey(Schema.Array(OtlpValue)) })),
		boolValue: Schema.optionalKey(Schema.Boolean),
		bytesValue: Schema.optionalKey(Schema.String),
		doubleValue: Schema.optionalKey(Schema.Number),
		intValue: Schema.optionalKey(Schema.String),
		kvlistValue: Schema.optionalKey(Schema.Struct({ values: Schema.optionalKey(Schema.Array(Attribute)) })),
		stringValue: Schema.optionalKey(Schema.String),
	}),
);
export const Attribute = Schema.Struct({ key: Schema.String, value: OtlpValue });
