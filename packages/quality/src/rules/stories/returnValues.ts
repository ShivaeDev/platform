import ts from "typescript";

export function returnValues(declaration: ts.Signature["declaration"]): readonly (ts.Expression | undefined)[] {
	const body = declaration !== undefined && "body" in declaration ? declaration.body : undefined;
	if (body === undefined) {
		return [];
	}
	if (!ts.isBlock(body)) {
		return [body];
	}
	const values: (ts.Expression | undefined)[] = [];
	function visit(node: ts.Node): void {
		if (ts.isFunctionLike(node)) {
			return;
		}
		if (ts.isReturnStatement(node)) {
			values.push(node.expression);
			return;
		}
		ts.forEachChild(node, visit);
	}
	visit(body);
	return values;
}
