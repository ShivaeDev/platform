import { expect } from "@effect/vitest";
import { Effect, Schema, SchemaParser } from "effect";
import { it } from "@shivaedev/test/it.ts";
import { messagesByField } from "#messages.ts";

const Fields = Schema.Struct({
	berth: Schema.String.check(Schema.isNonEmpty({ message: "Enter a berth" })),
	role: Schema.NonEmptyString,
});

it.effect("an empty required field reads as Required while an explicit schema message takes precedence", function* () {
	const issue = yield* Effect.flip(
		SchemaParser.decodeUnknownEffect(Fields, { errors: "all" })({
			berth: "",
			role: "",
		}),
	);
	expect(messagesByField(issue)).toEqual({
		berth: "Enter a berth",
		role: "Required",
	});
});

it.effect("a form-level refinement does not invent a field for its error", function* () {
	const Validation = Schema.Struct({ confirmation: Schema.String, password: Schema.String }).check(
		Schema.makeFilter((value) => value.password === value.confirmation, { message: "Passwords must match" }),
	);
	const issue = yield* Effect.flip(SchemaParser.decodeUnknownEffect(Validation)({ confirmation: "second", password: "first" }));
	expect(messagesByField(issue)).toEqual({});
});

it.effect("multiple nested failures keep the first message for their top-level field", function* () {
	const Validation = Schema.Struct({ profile: Fields });
	const issue = yield* Effect.flip(SchemaParser.decodeUnknownEffect(Validation, { errors: "all" })({ profile: { berth: "", role: "" } }));
	expect(messagesByField(issue)).toEqual({ profile: "Enter a berth" });
});
