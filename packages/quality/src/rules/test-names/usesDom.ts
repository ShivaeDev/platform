import ts from "typescript";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/syntax.ts";

const DOM_GLOBALS: ReadonlySet<string> = new Set(["document", "window"]);

const TESTING_LIBRARY = "@testing-library/";

function touchesDom(node: ts.Node, checker: ts.TypeChecker): boolean {
	if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
		return node.moduleSpecifier.text.startsWith(TESTING_LIBRARY);
	}
	if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && DOM_GLOBALS.has(node.expression.text)) {
		return (checker.getSymbolAtLocation(node.expression)?.declarations ?? []).length === 0;
	}
	return ts.forEachChild(node, (child) => touchesDom(child, checker)) ?? false;
}

export function usesDom(file: SourceFile): boolean {
	const source = parse(file);
	if (source === undefined) {
		return false;
	}
	const options: ts.CompilerOptions = { allowJs: true, noLib: true, noResolve: true };
	const host = ts.createCompilerHost(options);
	host.getSourceFile = (path) => (path === source.fileName ? source : undefined);
	const checker = ts.createProgram([source.fileName], options, host).getTypeChecker();
	return touchesDom(source, checker);
}
