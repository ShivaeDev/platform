import { Option, Schema } from "effect";

export const ListingCursor = Schema.StringFromBase64Url.pipe(
	Schema.decodeTo(
		Schema.fromJsonString(
			Schema.Tuple([
				Schema.String.check(Schema.makeFilter((value) => Option.isSome(Schema.decodeUnknownOption(Schema.DateTimeUtcFromString)(value)))),
				Schema.String.check(Schema.isUUID()),
			]),
		),
	),
);

export const ListingPageOptions = Schema.Struct({
	cursor: Schema.optionalKey(Schema.UndefinedOr(ListingCursor)),
	limit: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
});
