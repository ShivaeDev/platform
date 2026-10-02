import ts from "typescript";
import type { SourceFile } from "../../rule.ts";
import { parse } from "../syntax.ts";

export interface SourceComment {
	readonly kind: "block" | "line";
	readonly text: string;
	readonly body: ReadonlyArray<string>;
	readonly line: number;
	readonly endLine: number;
	readonly ownLine: boolean;
}

const DECLARATION = /\.d\.[cm]?ts$/;

const commentRanges = (source: ts.SourceFile): ReadonlyArray<ts.CommentRange> => {
	const ranges = new Map<number, ts.CommentRange>();
	const jsxText: Array<ts.Node> = [];
	const add = (found: ReadonlyArray<ts.CommentRange> | undefined) => {
		for (const range of found ?? []) {
			ranges.set(range.pos, range);
		}
	};
	const visit = (node: ts.Node) => {
		if (node.kind === ts.SyntaxKind.JsxText) {
			jsxText.push(node);
		}
		add(ts.getLeadingCommentRanges(source.text, node.pos));
		add(ts.getTrailingCommentRanges(source.text, node.end));
		for (const child of node.getChildren(source)) {
			visit(child);
		}
	};
	visit(source);
	return [...ranges.values()]
		.filter((range) => !jsxText.some((text) => range.pos >= text.pos && range.pos < text.end))
		.sort((left, right) => left.pos - right.pos);
};

export const bodyOf = (kind: SourceComment["kind"], text: string): ReadonlyArray<string> =>
	kind === "line"
		? [text.slice(2).trim()]
		: text
				.slice(2, -2)
				.split("\n")
				.map((line) => line.trim().replace(/^\*(?=\s|$)\s*/, ""));

const toComment = (source: ts.SourceFile, range: ts.CommentRange): SourceComment => {
	const kind = range.kind === ts.SyntaxKind.SingleLineCommentTrivia ? "line" : "block";
	const text = source.text.slice(range.pos, range.end);
	const start = source.getLineAndCharacterOfPosition(range.pos);
	const lineStart = source.getPositionOfLineAndCharacter(start.line, 0);
	return {
		body: bodyOf(kind, text),
		endLine: source.getLineAndCharacterOfPosition(range.end).line + 1,
		kind,
		line: start.line + 1,
		ownLine: source.text.slice(lineStart, range.pos).trim() === "",
		text,
	};
};

const scanned = new WeakMap<SourceFile, ReadonlyArray<SourceComment>>();

const scan = (file: SourceFile): ReadonlyArray<SourceComment> => {
	const source = parse(file);
	return source === undefined ? [] : commentRanges(source).map((range) => toComment(source, range));
};

export const scanComments = (file: SourceFile): ReadonlyArray<SourceComment> => {
	const cached = scanned.get(file);
	if (cached !== undefined) {
		return cached;
	}
	const comments = scan(file);
	scanned.set(file, comments);
	return comments;
};

export const commentsOf = (file: SourceFile): ReadonlyArray<SourceComment> => (DECLARATION.test(file.path) ? [] : scanComments(file));
