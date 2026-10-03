import { defineRule, type Finding, type Rule } from "../../rule.ts";
import { isDirective, textOf } from "./kinds.ts";
import { commentsOf, type SourceComment } from "./scan.ts";

interface PatternRule<Id extends string> {
	readonly description: string;
	readonly id: Id;
	readonly message: (match: string) => string;
	readonly patterns: readonly RegExp[];
}

const firstMatch = (comment: SourceComment, patterns: readonly RegExp[]): string | undefined => {
	const text = textOf(comment);
	return patterns.map((pattern) => pattern.exec(text)?.[0]).find((match) => match !== undefined);
};

export const definePatternRule = <const Id extends string>({ description, id, message, patterns }: PatternRule<Id>): Rule<Id, undefined> =>
	defineRule({
		check: ({ sources }) =>
			sources.flatMap((file) =>
				commentsOf(file).flatMap((comment): readonly Finding[] => {
					const match = isDirective(comment) ? undefined : firstMatch(comment, patterns);
					return match === undefined ? [] : [{ file: file.path, line: comment.line, message: message(match) }];
				}),
			),
		description,
		id,
	});
