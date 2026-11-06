import ts from "typescript";

export function frameworkOwner(
	checker: ts.TypeChecker,
	node: ts.Node,
	local: ReadonlySet<ts.SourceFile>,
	callback: (node: ts.Node) => boolean,
	seen = new Set<ts.Node>(),
): boolean {
	if (seen.has(node)) {
		return false;
	}
	seen.add(node);
	if (ts.isArrayLiteralExpression(node)) {
		return true;
	}
	if (ts.isYieldExpression(node)) {
		return node.expression !== undefined && frameworkOwner(checker, node.expression, local, callback, seen);
	}
	if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node) || ts.isParenthesizedExpression(node)) {
		return frameworkOwner(checker, node.expression, local, callback, seen);
	}
	if (!ts.isIdentifier(node)) {
		return false;
	}
	const symbol = checker.getSymbolAtLocation(node);
	const target = symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
	return (target?.declarations ?? []).some((declaration) => {
		if (!local.has(declaration.getSourceFile())) {
			return true;
		}
		if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
			return frameworkOwner(checker, declaration.initializer, local, callback, seen);
		}
		let parameter: ts.Node = declaration;
		while (ts.isBindingElement(parameter) || ts.isObjectBindingPattern(parameter) || ts.isArrayBindingPattern(parameter)) {
			parameter = parameter.parent;
		}
		return ts.isParameter(parameter) && callback(parameter.parent);
	});
}
