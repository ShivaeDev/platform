import { Result, Schema, SchemaParser } from "effect";
import { expect, it } from "vitest";
import { emptyAsNull } from "#emptyAsNull.ts";

it("empty inputs decode to null and populated inputs retain their codec", () => {
	const schema = emptyAsNull(Schema.NumberFromString);
	const decode = SchemaParser.decodeUnknownResult(schema);
	const encode = SchemaParser.encodeResult(schema);
	expect(Result.getOrThrow(decode(""))).toBeNull();
	expect(Result.getOrThrow(decode("42"))).toBe(42);
	expect(Result.getOrThrow(encode(null))).toBe("");
	expect(Result.getOrThrow(encode(42))).toBe("42");
});
