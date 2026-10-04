import ts from "typescript";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/syntax.ts";

const DOM_GLOBALS: ReadonlySet<string> = new Set(["document", "window"]);

const TESTING_LIBRARY = "@testing-library/";

function touchesDom(node: ts.Node): boolean {
	if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
		return node.moduleSpecifier.text.startsWith(TESTING_LIBRARY);
	}
	if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && DOM_GLOBALS.has(node.expression.text)) {
		return true;
	}
	return ts.forEachChild(node, touchesDom) ?? false;
}

export function usesDom(file: SourceFile): boolean {
	const source = parse(file);
	return source === undefined ? false : touchesDom(source);
}
