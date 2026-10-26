import { Option, Schema } from "effect";
export interface RejectedField {
	readonly field: string;
	readonly message: string;
}
const Rejected = Schema.Struct({ _tag: Schema.String, field: Schema.String, message: Schema.String });
const decode = Schema.decodeUnknownOption(Rejected);
export function rejectedField(error: unknown): Option.Option<RejectedField> {
	return Option.map(decode(error), ({ field, message }) => ({ field, message }));
}
