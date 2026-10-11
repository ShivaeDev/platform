import { readFileSync } from "node:fs";
import ts from "typescript";

export interface Syntax {
	readonly checker: ts.TypeChecker;
	readonly source: ts.SourceFile;
}

export function syntaxOf(path: string): Syntax {
	const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
	const options: ts.CompilerOptions = { allowJs: true, noLib: true, noResolve: true };
	const host = ts.createCompilerHost(options);
	host.getSourceFile = (file) => (file === path ? source : undefined);
	const program = ts.createProgram([path], options, host);
	return { checker: program.getTypeChecker(), source };
}

export function offsetOf(source: ts.SourceFile, position: { readonly line: number; readonly column?: number }): number | undefined {
	const start = source.getLineStarts()[position.line - 1];
	if (start === undefined || position.column === undefined || position.column < 1) {
		return undefined;
	}
	const line = source.text.slice(start, source.getLineStarts()[position.line] ?? source.text.length);
	const characters = [...line];
	return position.column <= characters.length + 1 ? start + characters.slice(0, position.column - 1).join("").length : undefined;
}

export function nodeAt(source: ts.SourceFile, start: number, end: number): ts.Node | undefined {
	function visit(node: ts.Node): ts.Node | undefined {
		if (node.getStart(source) > start || node.end < end) {
			return undefined;
		}
		return ts.forEachChild(node, visit) ?? (node.getStart(source) === start && node.end === end ? node : undefined);
	}
	return visit(source);
}
