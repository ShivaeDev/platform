import ts from "typescript";

function declaredName(node: ts.Identifier): boolean {
	const parent = node.parent;
	if (ts.isBindingElement(parent)) {
		return parent.name === node || parent.propertyName === node;
	}
	return "name" in parent && parent.name === node && !ts.isPropertyAccessExpression(parent) && !ts.isShorthandPropertyAssignment(parent);
}

export function ownsParameters(checker: ts.TypeChecker, local: ReadonlySet<ts.SourceFile>) {
	const known = new Map<ts.Node, boolean>();
	return (root: ts.Node): boolean => {
		const previous = known.get(root);
		if (previous !== undefined) {
			return previous;
		}
		const seen = new Set<ts.Node>();
		function reference(node: ts.Identifier): boolean {
			const symbol = ts.isShorthandPropertyAssignment(node.parent)
				? checker.getShorthandAssignmentValueSymbol(node.parent)
				: checker.getSymbolAtLocation(node);
			if (symbol === undefined) {
				return false;
			}
			const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
			return (target.declarations ?? []).some((declaration) => local.has(declaration.getSourceFile()) && visit(declaration));
		}
		function visit(node: ts.Node): boolean {
			if (seen.has(node)) {
				return false;
			}
			seen.add(node);
			if (ts.isParameter(node)) {
				return local.has(node.getSourceFile());
			}
			if (ts.isIdentifier(node) && !declaredName(node) && reference(node)) {
				return true;
			}
			return ts.forEachChild(node, visit) ?? false;
		}
		const result = visit(root);
		known.set(root, result);
		return result;
	};
}
