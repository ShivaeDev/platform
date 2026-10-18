import { Schema } from "effect";
import { defineRule } from "#rule.ts";
import { isDirective, isJsdoc, isPragma, Pragmas } from "./kinds.ts";
import { commentsOf } from "./scan.ts";

const NoJsdocOptions = Schema.Struct({ allow: Pragmas });

export const noJsdoc = defineRule({
	check: ({ options, sources }) =>
		sources.flatMap((file) =>
			commentsOf(file)
				.filter((comment) => isJsdoc(comment) && !isPragma(comment, options.allow) && !isDirective(comment))
				.map((comment) => ({ file: file.path, line: comment.line, message: "JSDoc block." })),
		),
	description: "Names and types already say what a JSDoc block repeats. Delete it, and keep a reason the code cannot show as a short // comment.",
	id: "comments/no-jsdoc",
	options: Schema.toStandardSchemaV1(NoJsdocOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
