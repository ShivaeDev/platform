import { describe, expect, it } from "vitest";
import { encodeBaseline } from "#baseline/format.ts";

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
