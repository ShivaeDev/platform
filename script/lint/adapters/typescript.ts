import ts from "typescript";

export interface SourceComment {
	readonly content: string;
	readonly endLine: number;
	readonly fullLine: boolean;
	readonly kind: "block" | "line";
	readonly line: number;
}

const commentRanges = (source: ts.SourceFile): readonly ts.CommentRange[] => {
	const ranges = new Map<string, ts.CommentRange>();
	const jsxTextSpans: Array<{ readonly end: number; readonly pos: number }> = [];
	const add = (found: readonly ts.CommentRange[] | undefined) => {
		for (const range of found ?? []) {
			ranges.set(`${range.pos}:${range.end}`, range);
		}
	};
	const visit = (node: ts.Node) => {
		if (node.kind === ts.SyntaxKind.JsxText) {
			jsxTextSpans.push({ end: node.end, pos: node.pos });
		}
		add(ts.getLeadingCommentRanges(source.text, node.pos));
		add(ts.getTrailingCommentRanges(source.text, node.end));
		for (const child of node.getChildren(source)) {
			visit(child);
		}
	};
	visit(source);
	return [...ranges.values()]
		.filter((range) => !jsxTextSpans.some((span) => range.pos >= span.pos && range.pos < span.end))
		.sort((left, right) => left.pos - right.pos);
};

export const parseSource = (path: string, content: string): ts.SourceFile =>
	ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

export const sourceComments = (path: string, content: string): readonly SourceComment[] => {
	const source = parseSource(path, content);
	return commentRanges(source).map((range) => {
		const start = source.getLineAndCharacterOfPosition(range.pos);
		const end = source.getLineAndCharacterOfPosition(range.end - 1);
		const lineStart = source.getPositionOfLineAndCharacter(start.line, 0);
		return {
			content: content.slice(range.pos, range.end),
			endLine: end.line + 1,
			fullLine: content.slice(lineStart, range.pos).trim() === "",
			kind: range.kind === ts.SyntaxKind.SingleLineCommentTrivia ? "line" : "block",
			line: start.line + 1,
		};
	});
};
