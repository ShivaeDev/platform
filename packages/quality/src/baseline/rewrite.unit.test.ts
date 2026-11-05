import { describe, expect, it } from "vitest";
import { type BaselineEntry, encodeBaseline } from "#baseline/format.ts";
import { rewriteBaseline } from "#baseline/rewrite.ts";

function lines(...rows: readonly string[]): string {
	return rows.map((row) => `${row}\n`).join("");
}

const z = { count: 2, file: "src/z.ts", rule: "comments/no-jsdoc" };
const a = { count: 4, file: "src/a.ts", rule: "comments/no-jsdoc" };
const big = { count: 270, file: "src/big.ts", rule: "structure/max-lines" };
const m = { count: 1, file: "src/m.ts", rule: "comments/no-todo" };

const unsorted = lines(
	'{"path":"src/z.ts","rule":"comments/no-jsdoc","count":2}',
	'{ "path": "src/a.ts", "rule": "comments/no-jsdoc", "count": 4 }',
	'{"path":"src/big.ts","rule":"structure/max-lines","count":270}',
	'{"path":"src/m.ts","rule":"comments/no-todo","count":1}',
);
const read: readonly BaselineEntry[] = [z, a, big, m];

describe("rewriteBaseline", () => {
	it("keeps every line byte for byte when nothing changed", () => {
		expect(rewriteBaseline(unsorted, read, read)).toBe(unsorted);
	});

	it("changes only the lines it lowers or removes, and never re-sorts the rest", () => {
		expect(rewriteBaseline(unsorted, read, [z, a, { ...big, count: 250 }])).toBe(
			lines(
				'{"path":"src/z.ts","rule":"comments/no-jsdoc","count":2}',
				'{ "path": "src/a.ts", "rule": "comments/no-jsdoc", "count": 4 }',
				'{"path":"src/big.ts","rule":"structure/max-lines","count":250}',
			),
		);
	});

	it("puts a new or moved entry before the first line that sorts after it", () => {
		const todo = { count: 1, file: "src/a.ts", rule: "comments/no-todo" };
		const long = { count: 150, file: "src/c.ts", rule: "structure/max-lines" };
		const moved = { count: 2, file: "src/e.ts", rule: "comments/no-todo" };
		const sorted = [todo, long, moved];
		const after = [todo, long, { ...moved, file: "lib/e.ts" }, { count: 1, file: "src/d.ts", rule: "comments/no-jsdoc" }];
		expect(rewriteBaseline(encodeBaseline(sorted), sorted, after)).toBe(
			lines(
				'{"path":"lib/e.ts","rule":"comments/no-todo","count":2}',
				'{"path":"src/a.ts","rule":"comments/no-todo","count":1}',
				'{"path":"src/c.ts","rule":"structure/max-lines","count":150}',
				'{"path":"src/d.ts","rule":"comments/no-jsdoc","count":1}',
			),
		);
	});

	it("writes a new baseline in sorted order", () => {
		const entries = [
			{ count: 1, file: "src/b.ts", rule: "local/todo" },
			{ count: 3, file: "src/a.ts", rule: "local/todo" },
		];
		expect(rewriteBaseline(undefined, [], entries)).toBe(encodeBaseline(entries));
	});
});
