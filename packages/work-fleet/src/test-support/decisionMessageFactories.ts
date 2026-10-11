import ts from "typescript";

export function decisionMessageFactories(tree: ts.SourceFile) {
	const factories = new Map<string, number[]>();
	function visit(node: ts.Node) {
		if (ts.isFunctionDeclaration(node) && node.name !== undefined && node.body !== undefined) {
			factories.set(node.name.text, messageParameters(tree, node.parameters, node.body));
		}
		ts.forEachChild(node, visit);
	}
	visit(tree);
	return factories;
}

function messageParameters(tree: ts.SourceFile, parameters: ts.NodeArray<ts.ParameterDeclaration>, body: ts.Block) {
	const positions = new Set<number>();
	function visit(node: ts.Node) {
		const value = messageValue(tree, node);
		const index = parameters.findIndex((parameter) => parameter.name.getText(tree) === value);
		if (index >= 0) {
			positions.add(index);
		}
		ts.forEachChild(node, visit);
	}
	visit(body);
	return [...positions];
}

function messageValue(tree: ts.SourceFile, node: ts.Node) {
	if (ts.isPropertyAssignment(node) && node.name.getText(tree) === "message") {
		return node.initializer.getText(tree);
	}
	return ts.isShorthandPropertyAssignment(node) && node.name.text === "message" ? "message" : undefined;
}
