import ts from "typescript";
import { unwrapped } from "#rules/stories/syntax.ts";

function functionOf(name: ts.Node): ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined {
	const declaration = name.parent;
	if (ts.isFunctionDeclaration(declaration)) {
		return declaration;
	}
	const value = ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
	const node = value === undefined ? undefined : unwrapped(value);
	return node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) ? node : undefined;
}

function action(node: ts.Node, readCall: (call: ts.CallExpression) => boolean): boolean {
	if (
		((ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node))
			&& (node.asteriskToken !== undefined || node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)))
		|| ts.isJsxElement(node)
		|| ts.isJsxSelfClosingElement(node)
		|| ts.isJsxFragment(node)
		|| ts.isAwaitExpression(node)
		|| ts.isYieldExpression(node)
		|| ts.isNewExpression(node)
		|| ts.isThrowStatement(node)
		|| ts.isDeleteExpression(node)
		|| ts.isPostfixUnaryExpression(node)
		|| (ts.isPrefixUnaryExpression(node) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator))
		|| (ts.isBinaryExpression(node)
			&& node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
			&& node.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
	) {
		return true;
	}
	return ts.isCallExpression(node) && !readCall(node);
}

export function pureReader(name: ts.Node, readCall: (call: ts.CallExpression) => boolean): boolean {
	const fn = functionOf(name);
	if (fn?.body === undefined || fn.asteriskToken !== undefined || fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
		return false;
	}
	let returns = !ts.isBlock(fn.body);
	let acts = false;
	let reads = false;
	function visit(node: ts.Node): void {
		returns ||= ts.isReturnStatement(node) && node.expression !== undefined;
		acts ||= action(node, readCall);
		reads ||= ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isBinaryExpression(node);
		ts.forEachChild(node, visit);
	}
	for (const parameter of fn.parameters) {
		visit(parameter);
	}
	visit(fn.body);
	return returns && reads && !acts;
}
