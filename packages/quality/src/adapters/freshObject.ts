import ts from "typescript";

function unparenthesized(node: ts.Expression): ts.Expression {
	return ts.isParenthesizedExpression(node) ? unparenthesized(node.expression) : node;
}

function enclosingFunction(node: ts.Node): ts.Node | undefined {
	for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
		if (ts.isFunctionLike(parent)) {
			return parent;
		}
	}
	return undefined;
}

function earlierWrite(node: ts.Identifier): boolean {
	const call = node.parent;
	return (
		ts.isCallExpression(call)
		&& call.arguments[0] === node
		&& ts.isPropertyAccessExpression(call.expression)
		&& call.expression.expression.getText() === "Object"
		&& ["assign", "defineProperty"].includes(call.expression.name.text)
	);
}

function usedBefore(checker: ts.TypeChecker, declaration: ts.VariableDeclaration, write: ts.Node): boolean {
	const symbol = checker.getSymbolAtLocation(declaration.name);
	function visit(node: ts.Node): boolean {
		if (node.pos >= write.pos) {
			return false;
		}
		if (ts.isIdentifier(node) && node !== declaration.name) {
			const referred = ts.isShorthandPropertyAssignment(node.parent)
				? checker.getShorthandAssignmentValueSymbol(node.parent)
				: checker.getSymbolAtLocation(node);
			if (referred === symbol && !earlierWrite(node)) {
				return true;
			}
		}
		return ts.forEachChild(node, visit) ?? false;
	}
	return visit(declaration.getSourceFile());
}

export function freshObject(checker: ts.TypeChecker, write: ts.Node, target: ts.Expression): boolean {
	const value = unparenthesized(target);
	if (ts.isNewExpression(value)) {
		return true;
	}
	const declaration = ts.isIdentifier(value) ? checker.getSymbolAtLocation(value)?.valueDeclaration : undefined;
	return (
		declaration !== undefined
		&& ts.isVariableDeclaration(declaration)
		&& (ts.getCombinedNodeFlags(declaration) & ts.NodeFlags.Const) !== 0
		&& declaration.initializer !== undefined
		&& ts.isNewExpression(unparenthesized(declaration.initializer))
		&& enclosingFunction(declaration) === enclosingFunction(write)
		&& !usedBefore(checker, declaration, write)
	);
}
