import type { SourceComment } from "../comments/scan.ts";

export const SUPPRESSIONS: ReadonlyArray<RegExp> = [
	/^biome-ignore(?:-all|-start)?(?![\w-])/,
	/^@ts-(?:ignore|expect-error|nocheck)(?![\w-])/,
	/^(?:eslint|oxlint|stylelint)-disable(?:-next-line|-line)?(?![\w-])/,
	/^deno-lint-ignore(?:-file)?(?![\w-])/,
	/^tslint:disable/,
	/^prettier-ignore(?![\w-])/,
	/^\$Flow(?:FixMe|Ignore|ExpectedError|Issue)(?!\w)/,
	/^@noflow(?!\w)/,
];

const INLINE_ESLINT_CONFIG = /^eslint\s+["']?[\w@/-]+["']?\s*:/;

const LEADER = /^[\s/*]+/;

const directiveOn = (comment: SourceComment, line: string): string | undefined => {
	const content = line.replace(LEADER, "");
	const patterns = comment.kind === "block" ? [...SUPPRESSIONS, INLINE_ESLINT_CONFIG] : SUPPRESSIONS;
	return patterns.map((pattern) => pattern.exec(content)?.[0].replace(/\s*:$/, "")).find((match) => match !== undefined);
};

export const suppressionIn = (comment: SourceComment): string | undefined =>
	comment.body.map((line) => directiveOn(comment, line)).find((directive) => directive !== undefined);
