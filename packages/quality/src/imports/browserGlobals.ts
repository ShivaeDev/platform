import { Effect } from "effect";
import ts from "typescript";
import { ImportCompiler } from "#adapters/import-compiler/service.ts";
import { browserNames } from "#imports/browserNames.ts";
import type { Finding, SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

function unbound(checker: ts.TypeChecker, node: ts.Identifier): boolean {
	return (checker.getSymbolAtLocation(node)?.declarations ?? []).length === 0;
}

function globalThisRoot(expression: ts.Expression, checker: ts.TypeChecker): boolean {
	let root = expression;
	while (
		ts.isParenthesizedExpression(root)
		|| ts.isAsExpression(root)
		|| ts.isTypeAssertionExpression(root)
		|| ts.isNonNullExpression(root)
		|| ts.isSatisfiesExpression(root)
	) {
		root = root.expression;
	}
	return ts.isIdentifier(root) && root.text === "globalThis" && unbound(checker, root);
}

function qualifiedName(node: ts.PropertyAccessExpression | ts.ElementAccessExpression, checker: ts.TypeChecker): string | undefined {
	const root = node.expression;
	if (!globalThisRoot(root, checker)) {
		return undefined;
	}
	if (ts.isPropertyAccessExpression(node)) {
		return node.name.text;
	}
	return ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : undefined;
}

function bindingName(node: ts.Identifier): boolean {
	const parent = node.parent;
	return ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node);
}

function globalName(node: ts.Node, checker: ts.TypeChecker): string | undefined {
	if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
		return qualifiedName(node, checker);
	}
	if (!ts.isIdentifier(node)) {
		return undefined;
	}
	const parent = node.parent;
	if (bindingName(node) || ts.isLabeledStatement(parent) || ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) {
		return undefined;
	}
	if ((ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isPropertyAssignment(parent) && parent.name === node)) {
		return undefined;
	}
	if (ts.isShorthandPropertyAssignment(parent)) {
		return checker.getShorthandAssignmentValueSymbol(parent) === undefined ? node.text : undefined;
	}
	return unbound(checker, node) ? node.text : undefined;
}

function propertyName(node: ts.Node): readonly string[] {
	if (ts.isComputedPropertyName(node) && ts.isStringLiteral(node.expression)) {
		return [node.expression.text];
	}
	return ts.isIdentifier(node) || ts.isStringLiteral(node) ? [node.text] : [];
}

function destructuringOf(
	node: ts.Node,
): { readonly pattern: ts.ObjectBindingPattern | ts.ObjectLiteralExpression; readonly root: ts.Expression } | undefined {
	if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && ts.isObjectBindingPattern(node.name) && node.initializer !== undefined) {
		return { pattern: node.name, root: node.initializer };
	}
	if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isObjectLiteralExpression(node.left)) {
		return { pattern: node.left, root: node.right };
	}
	return undefined;
}

function destructuredNames(node: ts.Node, checker: ts.TypeChecker): readonly string[] {
	const destructuring = destructuringOf(node);
	if (destructuring === undefined) {
		return [];
	}
	const { pattern, root } = destructuring;
	if (!globalThisRoot(root, checker)) {
		return [];
	}
	if (ts.isObjectBindingPattern(pattern)) {
		return pattern.elements.flatMap((element) => (element.dotDotDotToken === undefined ? propertyName(element.propertyName ?? element.name) : []));
	}
	return pattern.properties.flatMap((property) =>
		ts.isShorthandPropertyAssignment(property) || ts.isPropertyAssignment(property) ? propertyName(property.name) : [],
	);
}

function superclassesOf(node: ts.HeritageClause): readonly ts.Expression[] {
	if (node.token !== ts.SyntaxKind.ExtendsKeyword || !(ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent))) {
		return [];
	}
	return node.types.map((base) => base.expression);
}

const globalsIn = Effect.fn("Imports.globalsIn")(function* (file: SourceFile, browser: ReadonlySet<string>) {
	const parsed = parse(file);
	if (parsed === undefined) {
		return [];
	}
	const source = parsed;
	const compiler = yield* ImportCompiler;
	const checker = yield* compiler.browserChecker(source);
	const findings: Finding[] = [];
	function visit(node: ts.Node): void {
		if (ts.isHeritageClause(node)) {
			for (const expression of superclassesOf(node)) {
				visit(expression);
			}
			return;
		}
		if (ts.isTypeNode(node) || ts.isImportDeclaration(node) || ts.isExportSpecifier(node)) {
			return;
		}
		const direct = globalName(node, checker);
		const names = [...destructuredNames(node, checker), ...(direct === undefined ? [] : [direct])];
		for (const name of names.filter((candidate) => browser.has(candidate))) {
			findings.push({
				file: file.path,
				line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
				message: `Shared code uses browser global "${name}". Move browser-dependent code into src/client/ or pass the value into shared code.`,
				subject: name,
			});
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return findings;
}, Effect.provide(ImportCompiler.layer));

export const browserGlobals = Effect.fn("Imports.browserGlobals")(function* (files: readonly SourceFile[]) {
	const browser = yield* browserNames();
	const findings = yield* Effect.forEach(files, (file) => globalsIn(file, browser));
	return findings.flat();
});
