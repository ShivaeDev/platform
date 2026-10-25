import ts from "typescript";
import { isTestSupport, testName } from "#naming/testName.ts";
import type { Finding, SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

export function isSpec(path: string): boolean {
	return testName(path)?.kind === "spec" && !isTestSupport(path);
}

export function unwrapped(node: ts.Expression): ts.Expression {
	return ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)
		? unwrapped(node.expression)
		: node;
}

export function memberName(node: ts.Expression): string | undefined {
	const value = unwrapped(node);
	if (ts.isPropertyAccessExpression(value)) {
		return value.name.text;
	}
	return ts.isElementAccessExpression(value) && ts.isStringLiteralLike(value.argumentExpression) ? value.argumentExpression.text : undefined;
}

export function numericValue(node: ts.Expression): number | undefined {
	const value = unwrapped(node);
	if (ts.isNumericLiteral(value)) {
		return Number(value.text);
	}
	if (ts.isPrefixUnaryExpression(value) && (value.operator === ts.SyntaxKind.MinusToken || value.operator === ts.SyntaxKind.PlusToken)) {
		const operand = numericValue(value.operand);
		return operand === undefined ? undefined : operand * (value.operator === ts.SyntaxKind.MinusToken ? -1 : 1);
	}
	return undefined;
}

export function findingAt(source: ts.SourceFile, node: ts.Node, message: string): Finding {
	return { file: source.fileName, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, message };
}

export function nodesWhere(source: ts.SourceFile, accepts: (node: ts.Node) => boolean): readonly ts.Node[] {
	const found: ts.Node[] = [];
	function visit(node: ts.Node): void {
		if (accepts(node)) {
			found.push(node);
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return found;
}

export function topLevelHelpers(source: ts.SourceFile): readonly ts.Node[] {
	return source.statements.flatMap<ts.Node>((statement) => {
		if (ts.isFunctionDeclaration(statement)) {
			return statement.body === undefined ? [] : [statement.name ?? statement];
		}
		return ts.isVariableStatement(statement)
			? statement.declarationList.declarations.flatMap((declaration) => {
					const value = declaration.initializer === undefined ? undefined : unwrapped(declaration.initializer);
					return value !== undefined && functionValue(value) ? [declaration.name] : [];
				})
			: [];
	});
}

function functionValue(value: ts.Expression): boolean {
	const node = unwrapped(value);
	if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		return true;
	}
	if (!ts.isCallExpression(node)) {
		return false;
	}
	return ["fn", "fnUntraced"].includes(memberName(node.expression) ?? "") || (ts.isCallExpression(node.expression) && functionValue(node.expression));
}

export function syntaxFindings(file: SourceFile, select: (source: ts.SourceFile) => readonly ts.Node[], message: string): readonly Finding[] {
	const source = parse(file);
	return source === undefined ? [] : select(source).map((node) => findingAt(source, node, message));
}
