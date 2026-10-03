import { type Cause, Effect, Schema } from "effect";

export type RejectionValue<Tag extends string, Fields extends Schema.Struct.Fields> = Schema.TaggedStruct<Tag, Fields>["Type"] & Cause.YieldableError;

export type RejectionClass<Tag extends string, Fields extends Schema.Struct.Fields> = Schema.Class<
	RejectionValue<Tag, Fields>,
	Schema.TaggedStruct<Tag, Fields>,
	Cause.YieldableError
>;

export type TaggedRejection = Schema.Top & (new (...args: never) => { readonly _tag: string });

export type RejectionSpecs = { readonly [tag: string]: Schema.Struct.Fields | TaggedRejection };

export type Rejections<Specs extends RejectionSpecs> = {
	readonly [Tag in keyof Specs & string]: Specs[Tag] extends TaggedRejection
		? Specs[Tag]
		: Specs[Tag] extends Schema.Struct.Fields
			? RejectionClass<Tag, Specs[Tag]>
			: never;
};

export type RejectedBy<Specs extends RejectionSpecs> = {
	[Tag in keyof Specs & string]: Rejections<Specs>[Tag]["Type"];
}[keyof Specs & string];

export type Reject<Specs extends RejectionSpecs> = {
	readonly [Tag in keyof Specs & string]: Rejections<Specs>[Tag] extends new (
		...args: infer Arguments
	) => infer Value
		? (...args: Arguments) => Effect.Effect<never, Value>
		: never;
};

export type RejectionUnion<Specs extends RejectionSpecs> = [keyof Specs & string] extends [never]
	? Schema.Never
	: Schema.Union<ReadonlyArray<Rejections<Specs>[keyof Specs & string]>>;

export type MatchingTags<Specs extends RejectionSpecs> = {
	readonly [Tag in keyof Specs]: Specs[Tag] extends TaggedRejection
		? Specs[Tag]["Type"] extends { readonly _tag: Tag }
			? Specs[Tag]
			: `The rejection class under "${Tag & string}" must have that _tag`
		: Specs[Tag];
};

export interface RejectionSet<Specs extends RejectionSpecs> {
	readonly error: RejectionUnion<Specs>;
	readonly Rejection: Rejections<Specs>;
	readonly reject: Reject<Specs>;
}

interface LooseRejectionSet {
	readonly error: Schema.Top;
	readonly Rejection: { readonly [tag: string]: TaggedRejection };
	readonly reject: { readonly [tag: string]: (...args: ReadonlyArray<unknown>) => Effect.Effect<never, unknown> };
}

export function rejectionSet<const Specs extends RejectionSpecs>(specs: Specs): RejectionSet<Specs>;
export function rejectionSet(specs: RejectionSpecs): LooseRejectionSet {
	const classes = Object.entries(specs).map(([tag, spec]): readonly [string, TaggedRejection] => [
		tag,
		Schema.isSchema(spec) ? spec : Schema.TaggedError<Cause.YieldableError>()(tag, spec),
	]);
	return {
		error: classes.length === 0 ? Schema.Never : Schema.Union(classes.map(([, schema]) => schema)),
		Rejection: Object.fromEntries(classes),
		reject: Object.fromEntries(
			classes.map(([tag, Rejection]) => [tag, (...args: ReadonlyArray<unknown>) => Effect.fail(Reflect.construct(Rejection, args))]),
		),
	};
}

export type FieldRejection<Field extends string> = {
	readonly field: Schema.Literals<ReadonlyArray<Field>>;
	readonly message: Schema.String;
};

export function fieldRejection<const Fields extends Schema.Struct.Fields>(struct: { readonly fields: Fields }): FieldRejection<keyof Fields & string>;
export function fieldRejection<const Fields extends Schema.Struct.Fields, const Field extends keyof Fields & string>(
	struct: { readonly fields: Fields },
	fields: ReadonlyArray<Field>,
): FieldRejection<Field>;
export function fieldRejection(struct: { readonly fields: Schema.Struct.Fields }, fields?: ReadonlyArray<string>): FieldRejection<string> {
	return { field: Schema.Literals(fields ?? Object.keys(struct.fields)), message: Schema.String };
}
