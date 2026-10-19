import { expect } from "@effect/vitest";
import { Schema, SchemaParser } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { emptyAsNull } from "#optional.ts";

it.effect("empty inputs decode to null and populated inputs retain their codec", function* () {
	const schema = emptyAsNull(Schema.NumberFromString);
	const decode = SchemaParser.decodeUnknownEffect(schema);
	const encode = SchemaParser.encodeEffect(schema);
	expect(yield* decode("")).toBeNull();
	expect(yield* decode("42")).toBe(42);
	expect(yield* encode(null)).toBe("");
	expect(yield* encode(42)).toBe("42");
});
