import { Effect, Schema } from "effect";
import { plural } from "#report/plural.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";
import { isDirective, isPragma, Pragmas } from "./kinds.ts";
import { commentsOf, type SourceComment } from "./scan.ts";

const MaxPerFileOptions = Schema.Struct({
	allow: Pragmas,
	max: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)).pipe(Schema.withDecodingDefaultKey(Effect.succeed(2))),
});

const continues = (previous: SourceComment | undefined, comment: SourceComment): boolean =>
	previous !== undefined
	&& previous.kind === "line"
	&& comment.kind === "line"
	&& previous.ownLine
	&& comment.ownLine
	&& comment.line === previous.endLine + 1;

const commentBlocks = (comments: readonly SourceComment[]): readonly SourceComment[] =>
	comments.filter((comment, index) => !continues(comments[index - 1], comment));

const overCap = (file: SourceFile, max: number, allow: readonly string[]): readonly Finding[] => {
	const counted = commentsOf(file).filter((comment) => !(isDirective(comment) || isPragma(comment, allow)));
	const blocks = commentBlocks(counted);
	const first = blocks[max];
	return first === undefined
		? []
		: [
				{
					count: blocks.length - max,
					file: file.path,
					line: first.line,
					message: `${plural(blocks.length, "comment", "comments")} against a limit of ${max}.`,
					threshold: max,
				},
			];
};

export const maxPerFile = defineRule({
	check: ({ options, sources }) => sources.flatMap((file) => overCap(file, options.max, options.allow)),
	description:
		"A file that needs more than a few comments does too much, or its comments narrate the code. Delete the comments that restate the code, then split the file.",
	id: "comments/max-per-file",
	options: Schema.toStandardSchemaV1(MaxPerFileOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
