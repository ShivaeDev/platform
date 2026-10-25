import ts from "typescript";

export function sourceDecisionSites(file: string, source: string) {
	const sites: string[] = [];
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
	function add(node: ts.Node) {
		sites.push(`${file}: ${node.getText(tree).replace(/\s+/gu, " ")}`);
	}
	function creationReason(node: ts.CallExpression) {
		const expression = node.expression;
		if (
			(ts.isIdentifier(expression) && expression.text === "decision")
			|| (ts.isPropertyAccessExpression(expression)
				&& expression.name.text === "decision"
				&& ts.isIdentifier(expression.expression)
				&& expression.expression.text === "state")
		) {
			return node.arguments[1];
		}
		return ts.isIdentifier(expression) && expression.text === "waitingDecision" ? node.arguments[0] : undefined;
	}
	function decisionField(node: ts.PropertyAssignment) {
		if (node.name.getText(tree) === "step" && node.initializer.getText(tree) === '"waiting"') {
			return node;
		}
		if (node.name.getText(tree) !== "code" || !ts.isObjectLiteralExpression(node.parent)) {
			return undefined;
		}
		const parent = node.parent.parent;
		return ts.isPropertyAssignment(parent) && parent.name.getText(tree) === "decision" ? node.initializer : undefined;
	}
	function visit(node: ts.Node) {
		const reason = ts.isCallExpression(node) ? creationReason(node) : undefined;
		const field = ts.isPropertyAssignment(node) ? decisionField(node) : undefined;
		if (reason !== undefined) {
			add(reason);
		}
		if (field !== undefined) {
			add(field);
		}
		ts.forEachChild(node, visit);
	}

	visit(tree);
	return sites;
}
