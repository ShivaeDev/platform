type TimestampBrand =
	| { readonly __timestampPrecision: number | undefined }
	| { readonly __timestamptzPrecision: number | undefined };

type PreservedValue =
	| string
	| number
	| boolean
	| bigint
	| symbol
	| Date
	| Uint8Array
	| ArrayBuffer;

export type NormalizePrismaArguments<Arguments extends readonly unknown[]> = {
	[Index in keyof Arguments]: NormalizePrismaValue<Arguments[Index]>;
};

/**
 * Prisma Next's PostgreSQL codecs return JavaScript Dates for timestamp values,
 * while its generated contracts currently render precision-bearing timestamp
 * fields as branded strings. Keep the public Effect facade aligned with the
 * codec's actual input and output values without modifying generated contracts.
 */
export type NormalizePrismaValue<Value> = Value extends TimestampBrand
	? Date
	: Value extends PreservedValue
		? Value
		: Value extends (...arguments_: infer Arguments) => infer Result
			? (
					...arguments_: NormalizePrismaArguments<Arguments>
				) => NormalizePrismaValue<Result>
			: Value extends readonly unknown[]
				? { [Index in keyof Value]: NormalizePrismaValue<Value[Index]> }
				: Value extends object
					? { [Key in keyof Value]: NormalizePrismaValue<Value[Key]> }
					: Value;
