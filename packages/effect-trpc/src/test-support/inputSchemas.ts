import { type Effect, Schema } from "effect";
import { type RejectionError, rejectWith } from "#rejection.ts";
export class BadRequest extends Schema.TaggedError<BadRequest>()("BadRequest", {
	field: Schema.optionalKey(Schema.String),
	message: Schema.String,
}) {}
const Address = Schema.Struct({ city: Schema.NonEmptyString });
export const Profile = Schema.Struct({ address: Address, name: Schema.NonEmptyString, tags: Schema.Array(Schema.NonEmptyString) });
export const Range = Schema.Struct({ from: Schema.Number, to: Schema.Number }).check(
	Schema.makeFilter(({ from, to }) => from <= to || "from must not be after to"),
);
export class Spoofed extends Schema.TaggedError<Spoofed>()("BadRequest", { invalidInput: Schema.Unknown, message: Schema.String }) {}
export const Mark = Schema.Struct({ mark: Schema.Union([Schema.Boolean, Schema.String]) });
export const rejectSpoofed: <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, Exclude<E, Spoofed> | RejectionError, R> = Reflect.apply(
	rejectWith,
	undefined,
	[Spoofed],
);
