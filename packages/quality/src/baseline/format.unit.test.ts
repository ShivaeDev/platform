import { describe } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/test/adapters/it.ts";
import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { decodeBaseline, encodeBaseline } from "#baseline/format.ts";

const entries = [
	{ count: 262, file: "src/b.ts", rule: "structure/max-lines" },
	{ count: 3, file: "src/a.ts", rule: "local/todo" },
	{ count: 230, file: "src/a.ts", rule: "structure/max-lines" },
];

describe("encodeBaseline", () => {
	it.effect("writes one entry per line, sorted by path and then rule", function* () {
		yield* assertThat(encodeBaseline(entries), (actual) =>
			actual.toBe(
				[
					'{"path":"src/a.ts","rule":"local/todo","count":3}',
					'{"path":"src/a.ts","rule":"structure/max-lines","count":230}',
					'{"path":"src/b.ts","rule":"structure/max-lines","count":262}',
					"",
				].join("\n"),
			),
		);
	});
});

describe("decodeBaseline", () => {
	it.effect("preserves a retained finding's reason when its count is serialized again", function* () {
		const retained = {
			count: 1,
			file: "src/rows.ts",
			reason: "Dynamic rows need a schema supplied by the caller.",
			rule: "suppressions/no-double-cast",
		};

		yield* assertThat(yield* Effect.promise(() => decodeBaseline(encodeBaseline([retained]))), (actual) =>
			actual.toEqual({ _tag: "Valid", value: [retained] }),
		);
	});

	it.effect("reads back what encodeBaseline writes, in file order", function* () {
		yield* assertThat(yield* Effect.promise(() => decodeBaseline(encodeBaseline(entries))), (actual) =>
			actual.toEqual({ _tag: "Valid", value: [entries[1], entries[2], entries[0]] }),
		);
	});

	it.effect.each([
		["a missing file", undefined],
		["blank lines", "\n\n"],
	] satisfies ReadonlyArray<readonly [unknown, unknown]>)("reads %s as no entries", function* ([_, raw]) {
		yield* assertThat(yield* Effect.promise(() => decodeBaseline(raw)), (actual) => actual.toEqual({ _tag: "Valid", value: [] }));
	});

	it.effect.each([
		["a zero count", '{"path":"src/a.ts","rule":"local/todo","count":0}', "line 2: count"],
		["a fractional count", '{"path":"src/a.ts","rule":"local/todo","count":1.5}', "line 2: count"],
		["an unknown field", '{"path":"src/a.ts","rule":"local/todo","count":1,"line":3}', "line 2: line"],
		["a measure next to the count", '{"path":"src/a.ts","rule":"structure/max-lines","count":1,"measure":168}', "line 2: measure"],
		["a missing path", '{"rule":"local/todo","count":1}', "line 2: path"],
		["a line that is not JSON", "src/a.ts local/todo 1", "line 2:"],
		["a repeated entry", '{"path":"src/z.ts","rule":"local/todo","count":2}', "line 2: repeats the entry for local/todo in src/z.ts"],
		["the earlier JSON format", '{ "local/todo": { "src/a.ts": { "count": 1 } } }', "line 2: path"],
	] satisfies ReadonlyArray<readonly [unknown, unknown, unknown]>)("rejects %s, naming its line", function* ([_, line, issue]) {
		yield* assertThat(yield* Effect.promise(() => decodeBaseline(`{"path":"src/z.ts","rule":"local/todo","count":1}\n${line}\n`)), (actual, expect) =>
			actual.toEqual({
				_tag: "Invalid",
				issues: expect.arrayContaining([expect.stringContaining(issue)]),
			}),
		);
	});
});
