import { bodyOf, type SourceComment } from "../comments/scan.ts";

export const STYLESHEET = /\.(?:css|scss|less)$/;

const LINE_COMMENTS = /\.(?:scss|less)$/;

const TOKENS = String.raw`"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|url\([^)]*\)?|\/\*[\s\S]*?(?:\*\/|$)`;

const tokensOf = (path: string): RegExp => new RegExp(LINE_COMMENTS.test(path) ? `${TOKENS}|\\/\\/[^\\n]*` : TOKENS, "gi");

const lineOf = (text: string, offset: number): number => text.slice(0, offset).split("\n").length;

const toComment = (text: string, token: string, offset: number): SourceComment => {
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
};

export const stylesheetComments = (path: string, text: string): ReadonlyArray<SourceComment> =>
	[...text.matchAll(tokensOf(path))].flatMap((match) => (match[0].startsWith("/") ? [toComment(text, match[0], match.index)] : []));
