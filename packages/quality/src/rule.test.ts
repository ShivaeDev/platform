import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { defineRule } from "#rule.ts";
import type { StandardSchemaV1 } from "#standard-schema.ts";
import { checkRule, issuesOf } from "#test/inputs.ts";

const todo = defineRule({
	check: ({ sources }) =>
		sources.flatMap((file) =>
			file.lines.flatMap((text, index) => (text.includes("TODO") ? [{ file: file.path, line: index + 1, message: "Resolve this TODO." }] : [])),
		),
	description: "Resolve TODOs before merging.",
	id: "local/no-todo",
});

const Limit = Schema.Struct({ max: Schema.Int.pipe(Schema.withDecodingDefaultKey(Effect.succeed(2))) });

const limited = defineRule({
	check: async ({ files, options }) => (files.length > options.max ? [{ file: ".", message: `${files.length} files exceed ${options.max}.` }] : []),
	description: "Keep the repository small.",
	id: "local/max-files",
	options: Schema.toStandardSchemaV1(Limit, { parseOptions: { onExcessProperty: "error" } }),
});

const shouting: StandardSchemaV1<{ readonly word: string }, { readonly word: string }> = {
	"~standard": {
		validate: (value) =>
			typeof value === "object" && value !== null && "word" in value && typeof value.word === "string"
				? { value: { word: value.word.toUpperCase() } }
				: { issues: [{ message: "needs a word", path: [{ key: "word" }] }] },
		vendor: "test",
		version: 1,
	},
};

const echo = defineRule({
	check: ({ options }) => [{ file: "echo", message: options.word }],
	description: "Reports its option.",
	id: "local/echo",
	options: shouting,
});

describe("defineRule", () => {
	it("reports findings from the files a rule reads", async () => {
		const findings = await checkRule(todo, undefined, { sources: [{ content: "ok\n// TODO: later\n", path: "src/a.ts" }] });
		expect(findings).toEqual([{ file: "src/a.ts", line: 2, message: "Resolve this TODO." }]);
	});

	it("refuses options for a rule that declares none", async () => {
		expect(await issuesOf(todo, { strict: true })).toEqual(["this rule takes no options"]);
	});

	it("validates absent options as an empty object, so defaults apply", async () => {
		const findings = await checkRule(limited, undefined, { files: ["a", "b", "c"] });
		expect(findings).toEqual([{ file: ".", message: "3 files exceed 2." }]);
	});

	it("passes the decoded options to an asynchronous check", async () => {
		expect(await checkRule(limited, { max: 5 }, { files: ["a", "b", "c"] })).toEqual([]);
	});

	it("names the path of each option issue", async () => {
		expect(await issuesOf(limited, { max: "many" })).toEqual([expect.stringMatching(/^max: /u)]);
		expect(await issuesOf(echo, {})).toEqual(["word: needs a word"]);
	});

	it("accepts any Standard Schema, not only Effect's", async () => {
		expect(await checkRule(echo, { word: "quiet" }, {})).toEqual([{ file: "echo", message: "QUIET" }]);
	});
});
