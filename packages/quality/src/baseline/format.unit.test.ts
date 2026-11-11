import { describe, expect, it } from "vitest";
import { decodeBaseline, encodeBaseline } from "#baseline/format.ts";

const entries = [
	{ count: 262, file: "src/b.ts", rule: "structure/max-lines" },
	{ count: 3, file: "src/a.ts", rule: "local/todo" },
	{ count: 230, file: "src/a.ts", rule: "structure/max-lines" },
];

describe("encodeBaseline", () => {
	it("writes one entry per line, sorted by path and then rule", () => {
		expect(encodeBaseline(entries)).toBe(
			[
				'{"path":"src/a.ts","rule":"local/todo","count":3}',
				'{"path":"src/a.ts","rule":"structure/max-lines","count":230}',
				'{"path":"src/b.ts","rule":"structure/max-lines","count":262}',
				"",
			].join("\n"),
		);
	});
});

describe("the deep share of an entry", () => {
	it("is written after the count and read back, zero included", () => {
		const split = [{ count: 3, deep: 0, file: "src/a.ts", rule: "effect/boundary" }];
		expect(decodeBaseline(encodeBaseline(split))).toEqual({ _tag: "Valid", value: split });
	});

	it("cannot exceed the count it is part of", () => {
		expect(decodeBaseline('{"path":"src/a.ts","rule":"effect/boundary","count":1,"deep":2}\n')).toEqual({
			_tag: "Invalid",
			issues: ["line 1: records 2 deep findings of a count of 1"],
		});
	});
});
