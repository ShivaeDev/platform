import ts from "typescript";

function returnedExpression(node: ts.Node) {
	if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
		return node.body;
	}
	if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isBlock(node.body)) {
		const last = node.body.statements.at(-1);
		return last !== undefined && ts.isReturnStatement(last) ? last.expression : undefined;
	}
	return undefined;
}
function resetsErrors(node: ts.Node) {
	if (!ts.isCallExpression(node)) {
		return false;
	}
	const expression = node.expression.getText();
	const callback = node.arguments.at(-1);
	if (callback === undefined) {
		return false;
	}
	const returned = returnedExpression(callback);
	if (
		expression === "Effect.catch"
		&& returned !== undefined
		&& ts.isCallExpression(returned)
		&& returned.expression.getText() === "Effect.succeed"
	) {
		return true;
	}
	return expression === "Effect.mapError" && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) && callback.parameters.length === 0;
}

function waitingGuard(node: ts.Expression): boolean {
	if (!ts.isBinaryExpression(node)) {
		return false;
	}
	if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
		return waitingGuard(node.left) || waitingGuard(node.right);
	}
	return (
		node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
		&& ts.isPropertyAccessExpression(node.left)
		&& node.left.name.text === "stage"
		&& ts.isStringLiteral(node.right)
		&& node.right.text === "needs-human"
	);
}
export function decisionFlow(node: ts.Node): readonly ts.Node[] {
	if (ts.isTypeNode(node)) {
		return [];
	}
	if (ts.isBlock(node)) {
		const waiting = node.statements.findIndex(
			(statement) =>
				ts.isIfStatement(statement)
				&& waitingGuard(statement.expression)
				&& ts.isBlock(statement.thenStatement)
				&& statement.thenStatement.statements.some(ts.isReturnStatement),
		);
		if (waiting >= 0) {
			return node.statements.slice(0, waiting + 1);
		}
	}
	if (ts.isCallExpression(node)) {
		const reset = node.arguments.findLastIndex(resetsErrors);
		if (reset >= 0) {
			return node.arguments.slice(reset).flatMap((argument) => (argument.getText().startsWith("Effect.catch(") ? [] : [argument]));
		}
		if (node.expression.getText() === "Effect.tryPromise" && node.arguments[0] !== undefined && ts.isObjectLiteralExpression(node.arguments[0])) {
			return node.arguments[0].properties.filter((property) => property.name?.getText() === "catch");
		}
	}
	const children: ts.Node[] = [];
	ts.forEachChild(node, (child) => {
		children.push(child);
	});
	return children;
}
