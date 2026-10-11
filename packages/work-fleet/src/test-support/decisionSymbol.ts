import ts from "typescript";

export function decisionSymbol(checker: ts.TypeChecker, node: ts.Node) {
	const reference =
		node.parent !== undefined && ts.isShorthandPropertyAssignment(node.parent)
			? checker.getShorthandAssignmentValueSymbol(node.parent)
			: checker.getSymbolAtLocation(node);
	return reference !== undefined && (reference.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(reference) : reference;
}
