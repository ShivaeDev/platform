import { Schema } from "effect";
import { emptyAsNull } from "./emptyAsNull.ts";

export interface NumberOptions {
	readonly integer?: boolean;
	readonly max?: number;
	readonly min?: number;
	readonly optional?: boolean;
}
export function number(options?: NumberOptions & { readonly optional?: false }): Schema.Codec<number, string>;
export function number(options: NumberOptions): Schema.Codec<number | null, string>;
export function number(options: NumberOptions = {}): Schema.Codec<number | null, string> {
	let populated = Schema.NonEmptyString.pipe(Schema.decodeTo(Schema.FiniteFromString));
	if (options.min !== undefined) {
		populated = populated.check(Schema.isGreaterThanOrEqualTo(options.min));
	}
	if (options.max !== undefined) {
		populated = populated.check(Schema.isLessThanOrEqualTo(options.max));
	}
	if (options.integer) {
		populated = populated.check(Schema.isInt());
	}
	return Schema.Trim.pipe(Schema.decodeTo(options.optional ? emptyAsNull(populated) : populated));
}

export interface ListOptions {
	readonly max: number;
	readonly min?: number;
}

export function list<TItem extends Schema.Constraint>(item: TItem, options: ListOptions) {
	const values = Schema.Array(item).check(Schema.isMaxLength(options.max));
	return options.min === undefined ? values : values.check(Schema.isMinLength(options.min));
}
