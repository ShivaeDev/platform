import { expect } from "@effect/vitest";
import { Effect, Schema, SchemaIssue, SchemaParser } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { messagesByField } from "#messages.ts";

const Fields = Schema.Struct({
	berth: Schema.String.check(Schema.isMinLength(3)),
	role: Schema.NonEmptyString,
});

it.effect("a field left empty reads as Required and a longer minimum keeps its own words", function* () {
	const issue = yield* Effect.flip(
		SchemaParser.decodeUnknownEffect(Fields, { errors: "all" })({
			berth: "ab",
			role: "",
		}),
	);
	expect(messagesByField(issue)).toEqual({
		berth: "Expected a value with a length of at least 3",
		role: "Required",
	});
});

it.effect("custom filters and pattern checks keep their own validation messages", function* () {
	const Validation = Schema.Struct({
		code: Schema.String.check(Schema.isPattern(/^[A-Z]+$/u)),
		slug: Schema.String.check(Schema.makeFilter((value) => value.startsWith("entry-"), { expected: "an entry slug" })),
	});
	const issue = yield* Effect.flip(SchemaParser.decodeUnknownEffect(Validation, { errors: "all" })({ code: "lower", slug: "other" }));
	expect(messagesByField(issue)).toEqual({
		code: "Expected a string matching the RegExp ^[A-Z]+$",
		slug: "Expected an entry slug",
	});
});

it.effect("a form-level refinement does not invent a field for its error", function* () {
	const Validation = Schema.Struct({ confirmation: Schema.String, password: Schema.String }).check(
		Schema.makeFilter((value) => value.password === value.confirmation, { message: "Passwords must match" }),
	);
	const issue = yield* Effect.flip(SchemaParser.decodeUnknownEffect(Validation)({ confirmation: "second", password: "first" }));
	expect(SchemaIssue.makeFormatterStandardSchemaV1()(issue).issues).toEqual([{ message: "Passwords must match", path: [] }]);
	expect(messagesByField(issue)).toEqual({});
});

it.effect("multiple nested failures keep the first message for their top-level field", function* () {
	const Validation = Schema.Struct({ profile: Fields });
	const issue = yield* Effect.flip(SchemaParser.decodeUnknownEffect(Validation, { errors: "all" })({ profile: { berth: "ab", role: "" } }));
	expect(messagesByField(issue)).toEqual({ profile: "Expected a value with a length of at least 3" });
});
