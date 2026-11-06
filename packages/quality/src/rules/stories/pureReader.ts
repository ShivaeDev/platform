import ts from "typescript";
import { unwrapped } from "./syntax.ts";

const READ_METHODS = new Set([
	"at",
	"concat",
	"endsWith",
	"entries",
	"every",
	"filter",
	"find",
	"findIndex",
	"flat",
	"flatMap",
	"get",
	"has",
	"includes",
	"indexOf",
	"join",
	"keys",
	"lastIndexOf",
	"map",
	"match",
	"reduce",
	"replace",
	"slice",
	"some",
	"split",
	"startsWith",
	"substring",
	"toLowerCase",
	"toUpperCase",
	"trim",
	"values",
]);

function functionOf(name: ts.Node): ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined {
	const declaration = name.parent;
	if (ts.isFunctionDeclaration(declaration)) {
		return declaration;
	}
	const value = ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
	const node = value === undefined ? undefined : unwrapped(value);
	return node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) ? node : undefined;
}

function readerCall(node: ts.CallExpression, nativeCall: (call: ts.CallExpression) => boolean): boolean {
	const call = unwrapped(node.expression);
	return ts.isPropertyAccessExpression(call) && READ_METHODS.has(call.name.text) && nativeCall(node);
}

function action(node: ts.Node, nativeCall: (call: ts.CallExpression) => boolean): boolean {
	if (
		((ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node))
			&& (node.asteriskToken !== undefined || node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)))
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
	return ts.isCallExpression(node) && !readerCall(node, nativeCall);
}

export function pureReader(name: ts.Node, nativeCall: (call: ts.CallExpression) => boolean): boolean {
	const fn = functionOf(name);
	if (fn?.body === undefined || fn.asteriskToken !== undefined || fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
		return false;
	}
	let returns = !ts.isBlock(fn.body);
	let acts = false;
	let reads = false;
	function visit(node: ts.Node): void {
		returns ||= ts.isReturnStatement(node) && node.expression !== undefined;
		acts ||= action(node, nativeCall);
		reads ||= ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isBinaryExpression(node);
		ts.forEachChild(node, visit);
	}
	for (const parameter of fn.parameters) {
		visit(parameter);
	}
	visit(fn.body);
	return returns && reads && !acts;
}
