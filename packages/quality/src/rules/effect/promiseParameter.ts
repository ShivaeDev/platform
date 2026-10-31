import ts from "typescript";

export function promiseParameter(checker: ts.TypeChecker, node: ts.Node): string | undefined {
	if (!ts.isParameter(node)) {
		return undefined;
	}
	const seen = new Set<ts.Type>();
	function carries(type: ts.Type): boolean {
		if (seen.has(type)) {
			return false;
		}
		seen.add(type);
		if (["Promise", "PromiseLike"].includes(type.getSymbol()?.name ?? "")) {
			return true;
		}
		if (type.isUnionOrIntersection()) {
			return type.types.some(carries);
		}
		const constraint = checker.getBaseConstraintOfType(type);
		return (
			(constraint !== undefined && carries(constraint))
			|| type.getCallSignatures().some((signature) => carries(checker.getReturnTypeOfSignature(signature)))
		);
	}
	return carries(checker.getTypeAtLocation(node)) ? `Promise-typed parameter (${node.name.getText()})` : undefined;
}
