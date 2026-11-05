import { expect } from "@effect/vitest";
import { encodeBaseline } from "#baseline/format.ts";
import { baselineStory } from "#test/baselineStory.ts";

const entries = [
	{ count: 262, file: "src/b.ts", rule: "structure/max-lines" },
	{ count: 3, file: "src/a.ts", rule: "local/todo" },
	{ count: 230, file: "src/a.ts", rule: "structure/max-lines" },
];
baselineStory.it("preserves a retained finding's reason when its count is serialized again", [], function* ({ decode }) {
	const retained = {
		count: 1,
		file: "src/rows.ts",
		reason: "Dynamic rows need a schema supplied by the caller.",
		rule: "suppressions/no-double-cast",
	};

	expect(yield* decode(encodeBaseline([retained]))).toEqual({ _tag: "Valid", value: [retained] });
});

baselineStory.it("reads back what encodeBaseline writes, in file order", [], function* ({ decode }) {
	expect(yield* decode(encodeBaseline(entries))).toEqual({ _tag: "Valid", value: [entries[1], entries[2], entries[0]] });
});

for (const [label, raw] of [
	["a missing file", undefined],
	["blank lines", "\n\n"],
] satisfies ReadonlyArray<readonly [unknown, unknown]>) {
	baselineStory.it(`reads ${label} as no entries`, [], function* ({ decode }) {
		expect(yield* decode(raw)).toEqual({ _tag: "Valid", value: [] });
	});
}

for (const [label, line, issue] of [
	["a zero count", '{"path":"src/a.ts","rule":"local/todo","count":0}', "line 2: count"],
	["a fractional count", '{"path":"src/a.ts","rule":"local/todo","count":1.5}', "line 2: count"],
	["an unknown field", '{"path":"src/a.ts","rule":"local/todo","count":1,"line":3}', "line 2: line"],
	["a measure next to the count", '{"path":"src/a.ts","rule":"structure/max-lines","count":1,"measure":168}', "line 2: measure"],
	["a missing path", '{"rule":"local/todo","count":1}', "line 2: path"],
	["a line that is not JSON", "src/a.ts local/todo 1", "line 2:"],
	["a repeated entry", '{"path":"src/z.ts","rule":"local/todo","count":2}', "line 2: repeats the entry for local/todo in src/z.ts"],
	["the earlier JSON format", '{ "local/todo": { "src/a.ts": { "count": 1 } } }', "line 2: path"],
] satisfies ReadonlyArray<readonly [unknown, unknown, unknown]>) {
	baselineStory.it(`rejects ${label}, naming its line`, [], function* ({ decode }) {
		expect(yield* decode(`{"path":"src/z.ts","rule":"local/todo","count":1}\n${line}\n`)).toEqual({
			_tag: "Invalid",
			issues: expect.arrayContaining([expect.stringContaining(issue)]),
		});
	});
}
