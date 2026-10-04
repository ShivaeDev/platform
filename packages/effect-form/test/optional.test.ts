import { expect, it } from "@effect/vitest";
import { Effect, Schema, SchemaParser } from "effect";
import { emptyAsNull } from "#index.ts";

it.effect("empty inputs decode to null and populated inputs retain their codec", () =>
	Effect.gen(function* () {
		const schema = emptyAsNull(Schema.NumberFromString);
		const decode = SchemaParser.decodeUnknownEffect(schema);
		const encode = SchemaParser.encodeEffect(schema);
		expect(yield* decode("")).toBeNull();
		expect(yield* decode("42")).toBe(42);
		expect(yield* encode(null)).toBe("");
		expect(yield* encode(42)).toBe("42");
	}),
);
