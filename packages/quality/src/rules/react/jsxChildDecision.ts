import ts from "typescript";

function mapCall(node: ts.Node): boolean {
	return ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "map";
}

function componentWrapper(node: ts.CallExpression): boolean {
	const callee = node.expression;
	const name = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
	return ts.isIdentifier(name) && ["memo", "forwardRef"].includes(name.text);
}

function component(node: ts.Node): boolean {
	if (ts.isFunctionDeclaration(node)) {
		return node.name === undefined || /^[A-Z]/u.test(node.name.text);
	}
	if (ts.isMethodDeclaration(node)) {
		return ts.isClassLike(node.parent) && ts.isIdentifier(node.name) && node.name.text === "render";
	}
	let parent = node.parent;
	while (ts.isParenthesizedExpression(parent) || ts.isCallExpression(parent)) {
		if (ts.isCallExpression(parent) && !componentWrapper(parent)) {
			return false;
		}
		parent = parent.parent;
	}
	return ts.isExportAssignment(parent) || (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && /^[A-Z]/u.test(parent.name.text));
}

function literal(node: ts.Expression): boolean {
	if (ts.isParenthesizedExpression(node)) {
		return literal(node.expression);
	}
	return (
		ts.isStringLiteral(node)
		|| ts.isNumericLiteral(node)
		|| (ts.isPrefixUnaryExpression(node)
			&& (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken)
			&& ts.isNumericLiteral(node.operand))
	);
}

function boundary(node: ts.Node): boolean {
	return ts.isJsxAttribute(node) || ts.isJsxSpreadAttribute(node) || ts.isVariableDeclaration(node);
}

function jsxChild(node: ts.Node): boolean {
	return ts.isJsxExpression(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent));
}

function returnedComponent(node: ts.Node, returned: boolean): boolean {
	return (returned || (ts.isArrowFunction(node) && !ts.isBlock(node.body))) && component(node);
}

function childContext(node: ts.Node): { readonly mapped: boolean } | undefined {
	let mapped = false;
	let child = false;
	let returned = false;
	for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
		if (boundary(parent)) {
			return undefined;
		}
		child ||= jsxChild(parent);
		if (ts.isFunctionLike(parent) && !mapCall(parent.parent)) {
			return child && returnedComponent(parent, returned) ? { mapped } : undefined;
		}
		if (mapCall(parent)) {
			mapped = true;
			returned = false;
		}
		returned ||= ts.isReturnStatement(parent);
		if (!returned && ts.isStatement(parent) && !ts.isBlock(parent)) {
			return undefined;
		}
	}
	return undefined;
}

export function jsxChildDecision(node: ts.Node): { readonly mapped: boolean } | undefined {
	if (ts.isConditionalExpression(node)) {
		return literal(node.whenTrue) && literal(node.whenFalse) ? undefined : childContext(node);
	}
	return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? childContext(node) : undefined;
}
