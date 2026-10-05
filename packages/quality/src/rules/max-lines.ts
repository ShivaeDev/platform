import { Effect, Schema } from "effect";
import ignore from "ignore";
import { isTestCode } from "#naming/testName.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";

const DECLARATION = /\.d\.[cm]?ts$/u;

const Limit = Schema.Int.check(Schema.isGreaterThan(0));

const MaxLinesOptions = Schema.Struct({
	source: Limit.pipe(Schema.withDecodingDefaultKey(Effect.succeed(150))),
	test: Limit.pipe(Schema.withDecodingDefaultKey(Effect.succeed(300))),
	testFiles: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

const oversized = (file: SourceFile, limit: number): readonly Finding[] =>
	file.lines.length <= limit
		? []
		: [
				{
					count: file.lines.length - limit,
					file: file.path,
					message: `${file.lines.length} lines exceeds the ${limit}-line limit.`,
					threshold: limit,
				},
			];

export const maxLines = defineRule({
	check: ({ options, sources }) => {
		const suites = ignore().add([...options.testFiles]);
		return sources
			.filter((file) => !DECLARATION.test(file.path))
			.flatMap((file) => oversized(file, isTestCode(file.path) || suites.ignores(file.path) ? options.test : options.source));
	},
	description: "Keep each module to one job. Split a long file along its responsibilities; never golf it under the limit.",
	id: "structure/max-lines",
	options: Schema.toStandardSchemaV1(MaxLinesOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
