import { expect, it } from "@effect/vitest";
import { Effect, Schema, SchemaParser } from "effect";
import { messagesByField } from "#messages.ts";

const Fields = Schema.Struct({
	berth: Schema.String.check(Schema.isMinLength(3)),
	role: Schema.NonEmptyString,
});

it.effect("a field left empty reads as Required and a longer minimum keeps its own words", () =>
	Effect.gen(function* () {
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
	}),
);
