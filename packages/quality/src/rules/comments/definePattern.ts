import { defineRule, type Finding, type Rule } from "#rule.ts";
import { isDirective, textOf } from "./kinds.ts";
import { commentsOf, type SourceComment } from "./scan.ts";

interface PatternRule<TId extends string> {
	readonly description: string;
	readonly id: TId;
	readonly message: (match: string) => string;
	readonly patterns: readonly RegExp[];
}

function firstMatch(comment: SourceComment, patterns: readonly RegExp[]): string | undefined {
	const text = textOf(comment);
	return patterns.map((pattern) => pattern.exec(text)?.[0]).find((match) => match !== undefined);
}

export function definePatternRule<const TId extends string>({ description, id, message, patterns }: PatternRule<TId>): Rule<TId, undefined> {
	return defineRule({
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
}
