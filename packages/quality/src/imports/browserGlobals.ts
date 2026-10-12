import ts from "typescript";
import type { Finding, SourceFile } from "#rule.ts";
import { parse } from "#rules/syntax.ts";
import { browserNames } from "./browserNames.ts";

function checkerOf(source: ts.SourceFile): ts.TypeChecker {
	const options: ts.CompilerOptions = { allowJs: true, noLib: true, noResolve: true };
	const host = ts.createCompilerHost(options);
	host.getSourceFile = (path) => (path === source.fileName ? source : undefined);
	return ts.createProgram([source.fileName], options, host).getTypeChecker();
}

function unbound(checker: ts.TypeChecker, node: ts.Identifier): boolean {
	return (checker.getSymbolAtLocation(node)?.declarations ?? []).length === 0;
}

function qualifiedName(node: ts.PropertyAccessExpression | ts.ElementAccessExpression, checker: ts.TypeChecker): string | undefined {
	const root = node.expression;
	if (!(ts.isIdentifier(root) && root.text === "globalThis" && unbound(checker, root))) {
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

function destructuredNames(node: ts.Node, checker: ts.TypeChecker): readonly string[] {
	if (!(ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) || node.initializer === undefined) {
		return [];
	}
	const root = node.initializer;
	if (!(ts.isIdentifier(root) && root.text === "globalThis" && unbound(checker, root))) {
		return [];
	}
	return node.name.elements.flatMap((element) => {
		const name = element.propertyName ?? element.name;
		return element.dotDotDotToken === undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? [name.text] : [];
	});
}

function superclassesOf(node: ts.HeritageClause): readonly ts.Expression[] {
	if (node.token !== ts.SyntaxKind.ExtendsKeyword || !(ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent))) {
		return [];
	}
	return node.types.map((base) => base.expression);
}

export function browserGlobals(file: SourceFile): readonly Finding[] {
	const parsed = parse(file);
	if (parsed === undefined) {
		return [];
	}
	const source = parsed;
	const checker = checkerOf(source);
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
		for (const name of names.filter((candidate) => browserNames.has(candidate))) {
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
}
