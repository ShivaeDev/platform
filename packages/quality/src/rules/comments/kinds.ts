import { Effect, Schema } from "effect";
import { SUPPRESSIONS } from "../suppressions/directives.ts";
import type { SourceComment } from "./scan.ts";

export const DEFAULT_PRAGMAS: ReadonlyArray<string> = [
	"@vitest-environment",
	"@vitest-environment-options",
	"@jest-environment",
	"@jsx",
	"@jsxFrag",
	"@jsxImportSource",
	"@jsxRuntime",
];

export const Pragmas = Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_PRAGMAS)));

const DIRECTIVES: ReadonlyArray<RegExp> = [
	...SUPPRESSIONS,
	/^@ts-/u,
	/^biome-ignore/u,
	/^(?:eslint|oxlint|stylelint)-(?:disable|enable)/u,
	/^[#@]__(?:PURE|NO_SIDE_EFFECTS)__/u,
	/^(?:c8|v8|istanbul) ignore/u,
];

const TRIPLE_SLASH = /^\/\/\/\s*</u;

const contentOf = (comment: SourceComment): ReadonlyArray<string> => comment.body.filter((line) => line !== "");

const startsWithTag = (line: string, tags: ReadonlyArray<string>): boolean =>
	tags.some((tag) => line === tag || line.startsWith(`${tag} `) || line.startsWith(`${tag}\t`));

export const textOf = (comment: SourceComment): string => comment.body.join("\n");

export const isJsdoc = (comment: SourceComment): boolean => comment.kind === "block" && comment.text.startsWith("/**") && comment.text !== "/**/";

export const isPragma = (comment: SourceComment, pragmas: ReadonlyArray<string>): boolean => {
	const content = contentOf(comment);
	return content.length > 0 && content.every((line) => startsWithTag(line, pragmas));
};

export const isDirective = (comment: SourceComment): boolean => {
	const first = contentOf(comment)[0] ?? "";
	return TRIPLE_SLASH.test(comment.text) || DIRECTIVES.some((directive) => directive.test(first));
};
