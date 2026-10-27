import { type Cause, Effect, Schema } from "effect";

export type RejectionValue<TTag extends string, TFields extends Schema.Struct.Fields> = Schema.TaggedStruct<TTag, TFields>["Type"] &
	Cause.YieldableError;

export type RejectionClass<TTag extends string, TFields extends Schema.Struct.Fields> = Schema.Class<
	RejectionValue<TTag, TFields>,
	Schema.TaggedStruct<TTag, TFields>,
	Cause.YieldableError
>;

export type TaggedRejection = Schema.Top & (new (...args: never) => { readonly _tag: string });

export interface RejectionSpecs {
	readonly [tag: string]: Schema.Struct.Fields | TaggedRejection;
}

export type Rejections<TSpecs extends RejectionSpecs> = {
	readonly [TTag in keyof TSpecs & string]: TSpecs[TTag] extends TaggedRejection
		? TSpecs[TTag]
		: TSpecs[TTag] extends Schema.Struct.Fields
			? RejectionClass<TTag, TSpecs[TTag]>
			: never;
};

export type RejectedBy<TSpecs extends RejectionSpecs> = {
	[TTag in keyof TSpecs & string]: Rejections<TSpecs>[TTag]["Type"];
}[keyof TSpecs & string];

export type Reject<TSpecs extends RejectionSpecs> = {
	readonly [TTag in keyof TSpecs & string]: Rejections<TSpecs>[TTag] extends new (
		...args: infer TArguments
	) => infer TValue
		? (...args: TArguments) => Effect.Effect<never, TValue>
		: never;
};

export type RejectionUnion<TSpecs extends RejectionSpecs> = [keyof TSpecs & string] extends [never]
	? Schema.Never
	: Schema.Union<readonly Rejections<TSpecs>[keyof TSpecs & string][]>;

export type MatchingTags<TSpecs extends RejectionSpecs> = {
	readonly [TTag in keyof TSpecs]: TSpecs[TTag] extends TaggedRejection
		? TSpecs[TTag]["Type"] extends { readonly _tag: TTag }
			? TSpecs[TTag]
			: `The rejection class under "${TTag & string}" must have that _tag`
		: TSpecs[TTag];
};

export interface RejectionSet<TSpecs extends RejectionSpecs> {
	readonly error: RejectionUnion<TSpecs>;
	readonly Rejection: Rejections<TSpecs>;
	readonly reject: Reject<TSpecs>;
}

interface LooseRejectionSet {
	readonly error: Schema.Top;
	readonly Rejection: { readonly [tag: string]: TaggedRejection };
	readonly reject: { readonly [tag: string]: (...args: readonly unknown[]) => Effect.Effect<never, unknown> };
}

export function rejectionSet<const TSpecs extends RejectionSpecs>(specs: TSpecs): RejectionSet<TSpecs>;
export function rejectionSet(specs: RejectionSpecs): LooseRejectionSet {
	const classes = Object.entries(specs).map(([tag, spec]): readonly [string, TaggedRejection] => [
		tag,
		Schema.isSchema(spec) ? spec : Schema.TaggedError<Cause.YieldableError>()(tag, spec),
	]);
	return {
		error: classes.length === 0 ? Schema.Never : Schema.Union(classes.map(([, schema]) => schema)),
		Rejection: Object.fromEntries(classes),
		reject: Object.fromEntries(
			classes.map(([tag, Rejection]) => [tag, (...args: readonly unknown[]) => Effect.fail(Reflect.construct(Rejection, args))]),
		),
	};
}

export type FieldRejection<TField extends string> = Readonly<{
	field: Schema.Literals<readonly TField[]>;
	message: Schema.String;
}>;

export function fieldRejection<const TFields extends Schema.Struct.Fields>(struct: {
	readonly fields: TFields;
}): FieldRejection<keyof TFields & string>;
export function fieldRejection<const TFields extends Schema.Struct.Fields, const TField extends keyof TFields & string>(
	struct: { readonly fields: TFields },
	fields: readonly TField[],
): FieldRejection<TField>;
export function fieldRejection(struct: { readonly fields: Schema.Struct.Fields }, fields?: readonly string[]): FieldRejection<string> {
	return { field: Schema.Literals(fields ?? Object.keys(struct.fields)), message: Schema.String };
}
