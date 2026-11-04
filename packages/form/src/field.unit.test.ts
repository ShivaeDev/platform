import { Schema } from "effect";
import { expect, it } from "vitest";
import * as Field from "#field.ts";

it("encodes optional null as blank and populated numbers as text", () => {
	const encode = Schema.encodeSync(Field.number({ max: 100, min: 0, optional: true }));
	expect(encode(null)).toBe("");
	expect(encode(2.5)).toBe("2.5");
});

it("a list without a minimum accepts an empty encoded array", () => {
	const decode = Schema.decodeSync(Field.list(Field.number(), { max: 5 }));
	expect(decode([])).toEqual([]);
});
