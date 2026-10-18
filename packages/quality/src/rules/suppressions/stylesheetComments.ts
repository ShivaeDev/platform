import { bodyOf, type SourceComment } from "#rules/comments/scan.ts";

export const STYLESHEET = /\.(?:css|scss|less)$/u;

const LINE_COMMENTS = /\.(?:scss|less)$/u;

const TOKENS = String.raw`"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|url\([^)]*\)?|\/\*[\s\S]*?(?:\*\/|$)`;

function tokensOf(path: string): RegExp {
	return new RegExp(LINE_COMMENTS.test(path) ? `${TOKENS}|\\/\\/[^\\n]*` : TOKENS, "giu");
}

function lineOf(text: string, offset: number): number {
	return text.slice(0, offset).split("\n").length;
}

function toComment(text: string, token: string, offset: number): SourceComment {
	const kind = token.startsWith("//") ? "line" : "block";
	const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
	return {
		body: bodyOf(kind, kind === "block" && !token.endsWith("*/") ? `${token}*/` : token),
		endLine: lineOf(text, offset + token.length),
		kind,
		line: lineOf(text, offset),
		ownLine: text.slice(lineStart, offset).trim() === "",
		text: token,
	};
}

export function stylesheetComments(path: string, text: string): readonly SourceComment[] {
	return [...text.matchAll(tokensOf(path))].flatMap((match) => (match[0].startsWith("/") ? [toComment(text, match[0], match.index)] : []));
}
