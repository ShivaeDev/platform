import { Effect, Schema } from "effect";
import { isTestCode } from "#naming/testName.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";

const DECLARATION = /\.d\.[cm]?ts$/u;

const Limit = Schema.Int.check(Schema.isGreaterThan(0));

const MaxLinesOptions = Schema.Struct({
	source: Limit.check(Schema.isLessThanOrEqualTo(150)).pipe(Schema.withDecodingDefaultKey(Effect.succeed(150))),
	test: Limit.check(Schema.isLessThanOrEqualTo(300)).pipe(Schema.withDecodingDefaultKey(Effect.succeed(300))),
});

function oversized(file: SourceFile, limit: number): readonly Finding[] {
	return file.lines.length <= limit
		? []
		: [
				{
					count: file.lines.length - limit,
					file: file.path,
					message: `${file.lines.length} lines exceeds the ${limit}-line limit.`,
					threshold: limit,
				},
			];
}

export const maxLines = defineRule({
	check: ({ options, sources }) =>
		sources.filter((file) => !DECLARATION.test(file.path)).flatMap((file) => oversized(file, isTestCode(file.path) ? options.test : options.source)),
	description: "Keep each module to one job. Split a long file along its responsibilities; never golf it under the limit.",
	id: "structure/max-lines",
	options: Schema.toStandardSchemaV1(MaxLinesOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
