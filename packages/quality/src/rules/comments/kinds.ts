import { Effect, Schema } from "effect";
import { SUPPRESSIONS } from "#rules/suppressions/directives.ts";
import type { SourceComment } from "./scan.ts";

export const Pragmas = Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed<readonly string[]>([])));

const DIRECTIVES: readonly RegExp[] = [
	...SUPPRESSIONS,
	/^@ts-/u,
	/^biome-ignore/u,
	/^(?:eslint|oxlint|stylelint)-(?:disable|enable)/u,
	/^[#@]__(?:PURE|NO_SIDE_EFFECTS)__/u,
	/^(?:c8|v8|istanbul) ignore/u,
];

const TRIPLE_SLASH = /^\/\/\/\s*</u;

function contentOf(comment: SourceComment): readonly string[] {
	return comment.body.filter((line) => line !== "");
}

function startsWithTag(line: string, tags: readonly string[]): boolean {
	return tags.some((tag) => line === tag || line.startsWith(`${tag} `) || line.startsWith(`${tag}\t`));
}

export function textOf(comment: SourceComment): string {
	return comment.body.join("\n");
}

export function isJsdoc(comment: SourceComment): boolean {
	return comment.kind === "block" && comment.text.startsWith("/**") && comment.text !== "/**/";
}

export function isPragma(comment: SourceComment, pragmas: readonly string[]): boolean {
	const content = contentOf(comment);
	return content.length > 0 && content.every((line) => startsWithTag(line, pragmas));
}

export function isDirective(comment: SourceComment): boolean {
	const first = contentOf(comment)[0] ?? "";
	return TRIPLE_SLASH.test(comment.text) || DIRECTIVES.some((directive) => directive.test(first));
}
