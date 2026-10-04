import type { SourceComment } from "#rules/comments/scan.ts";

export const SUPPRESSIONS: readonly RegExp[] = [
	/^biome-ignore(?:-all|-start)?(?![\w-])/u,
	/^@ts-(?:ignore|expect-error|nocheck)(?![\w-])/u,
	/^(?:eslint|oxlint|stylelint)-disable(?:-next-line|-line)?(?![\w-])/u,
	/^deno-lint-ignore(?:-file)?(?![\w-])/u,
	/^tslint:disable/u,
	/^prettier-ignore(?![\w-])/u,
	/^\$Flow(?:FixMe|Ignore|ExpectedError|Issue)(?!\w)/u,
	/^@noflow(?!\w)/u,
];

const INLINE_ESLINT_CONFIG = /^eslint\s+["']?[\w@/-]+["']?\s*:/u;

const LEADER = /^[\s/*]+/u;

const directiveOn = (comment: SourceComment, line: string): string | undefined => {
	const content = line.replace(LEADER, "");
	const patterns = comment.kind === "block" ? [...SUPPRESSIONS, INLINE_ESLINT_CONFIG] : SUPPRESSIONS;
	return patterns.map((pattern) => pattern.exec(content)?.[0].replace(/\s*:$/u, "")).find((match) => match !== undefined);
};

export const suppressionIn = (comment: SourceComment): string | undefined =>
	comment.body.map((line) => directiveOn(comment, line)).find((directive) => directive !== undefined);
