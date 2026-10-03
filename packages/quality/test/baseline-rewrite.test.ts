import { describe, expect, it } from "vitest";
import { type BaselineEntry, decodeBaseline, encodeBaseline } from "../src/baseline/format.ts";
import { rewriteBaseline } from "../src/baseline/rewrite.ts";

const lines = (...rows: ReadonlyArray<string>): string => rows.map((row) => `${row}\n`).join("");

const unsorted = lines(
	'{"path":"src/z.ts","rule":"comments/no-jsdoc","count":2}',
	'{ "path": "src/a.ts", "rule": "comments/no-jsdoc", "count": 4 }',
	'{"path":"src/big.ts","rule":"structure/max-lines","count":270}',
	'{"path":"src/m.ts","rule":"comments/no-todo","count":1}',
);

const rewrite = async (raw: string, edit: (entries: ReadonlyArray<BaselineEntry>) => ReadonlyArray<BaselineEntry>) => {
	const decoded = await decodeBaseline(raw);
	const before = decoded._tag === "Valid" ? decoded.value : [];
	return rewriteBaseline(raw, before, edit(before));
};

const lowered = (entry: BaselineEntry): ReadonlyArray<BaselineEntry> => (entry.file === "src/big.ts" ? [{ ...entry, count: 250 }] : [entry]);

describe("baseline rewrite", () => {
	it("keeps every line byte for byte when nothing changed", async () => {
		expect(await rewrite(unsorted, (entries) => entries)).toBe(unsorted);
	});

	it("changes only the lines it lowers or removes, and never re-sorts the rest", async () => {
		const text = await rewrite(unsorted, (entries) => entries.flatMap((entry) => (entry.file === "src/m.ts" ? [] : lowered(entry))));
		expect(text).toBe(
			lines(
				'{"path":"src/z.ts","rule":"comments/no-jsdoc","count":2}',
				'{ "path": "src/a.ts", "rule": "comments/no-jsdoc", "count": 4 }',
				'{"path":"src/big.ts","rule":"structure/max-lines","count":250}',
			),
		);
	});

	it("puts a new or moved entry before the first line that sorts after it", async () => {
		const sorted = encodeBaseline([
			{ count: 1, file: "src/a.ts", rule: "comments/no-todo" },
			{ count: 150, file: "src/c.ts", rule: "structure/max-lines" },
			{ count: 2, file: "src/e.ts", rule: "comments/no-todo" },
		]);
		const text = await rewrite(sorted, (entries) => [
			...entries.map((entry) => (entry.file === "src/e.ts" ? { ...entry, file: "lib/e.ts" } : entry)),
			{ count: 1, file: "src/d.ts", rule: "comments/no-jsdoc" },
		]);
		expect(text).toBe(
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
