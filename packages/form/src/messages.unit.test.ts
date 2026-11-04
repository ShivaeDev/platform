import { Result, Schema, SchemaParser } from "effect";
import { expect, it } from "vitest";
import { messagesByField } from "#messages.ts";

const Fields = Schema.Struct({
	berth: Schema.String.check(Schema.isNonEmpty({ message: "Enter a berth" })),
	role: Schema.NonEmptyString,
});

it("an empty required field reads as Required while an explicit schema message takes precedence", () => {
	const issue = Result.getOrThrow(
		Result.flip(
			SchemaParser.decodeUnknownResult(Fields, { errors: "all" })({
				berth: "",
				role: "",
			}),
		),
	);
	expect(messagesByField(issue)).toEqual({
		berth: "Enter a berth",
		role: "Required",
	});
});

it("a form-level refinement does not invent a field for its error", () => {
	const Validation = Schema.Struct({ confirmation: Schema.String, password: Schema.String }).check(
		Schema.makeFilter((value) => value.password === value.confirmation, { message: "Passwords must match" }),
	);
	const issue = Result.getOrThrow(Result.flip(SchemaParser.decodeUnknownResult(Validation)({ confirmation: "second", password: "first" })));
	expect(messagesByField(issue)).toEqual({});
});

it("multiple nested failures keep the first message for their top-level field", () => {
	const Validation = Schema.Struct({ profile: Fields });
	const issue = Result.getOrThrow(Result.flip(SchemaParser.decodeUnknownResult(Validation, { errors: "all" })({ profile: { berth: "", role: "" } })));
	expect(messagesByField(issue)).toEqual({ profile: "Enter a berth" });
});
