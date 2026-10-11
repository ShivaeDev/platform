import ts from "typescript";

const boundaries: Readonly<Record<string, readonly string[]>> = {
	BoardGateway: ["get", "report"],
	FleetIntegrations: ["checks", "delivery", "main", "result"],
	FleetPolicy: ["refreshQuota"],
	ReportInspection: ["check"],
	SessionJournal: ["acknowledgeSession", "acknowledgeTurn"],
	SessionTransport: ["observe", "reconcile", "startSession", "startTurn"],
};
export function decisionRoots(trees: readonly ts.SourceFile[]) {
	const roots: ts.Node[] = [];
	function select(object: ts.ObjectLiteralExpression, fields: readonly string[]) {
		for (const property of object.properties) {
			if (ts.isSpreadAssignment(property) || (property.name !== undefined && fields.includes(property.name.getText()))) {
				roots.push(property);
			}
		}
	}
	function returnedObjects(node: ts.Node, fields: readonly string[]) {
		if (ts.isReturnStatement(node) && node.expression !== undefined && ts.isObjectLiteralExpression(node.expression)) {
			select(node.expression, fields);
		}
		ts.forEachChild(node, (child) => returnedObjects(child, fields));
	}
	function binding(node: ts.CallExpression) {
		const text = node.expression.getText();
		const service = text.endsWith(".of") ? text.slice(0, -3) : text.match(/^Layer\.(?:succeed|effect)\((?<service>\w+)\)$/u)?.groups?.service;
		const fields = service === undefined ? undefined : boundaries[service];
		if (fields !== undefined) {
			for (const argument of node.arguments) {
				if (ts.isObjectLiteralExpression(argument)) {
					select(argument, fields);
				} else {
					returnedObjects(argument, fields);
				}
			}
		}
	}
	function visit(node: ts.Node) {
		if (ts.isCallExpression(node)) {
			binding(node);
		}
		if (ts.isFunctionDeclaration(node) && node.type?.getText().includes("SessionTransport.Service")) {
			returnedObjects(node, boundaries.SessionTransport ?? []);
		}
		if (ts.isObjectLiteralExpression(node) && node.properties.some((property) => property.name?.getText() === "advance")) {
			select(node, ["advance", "launch"]);
		}
		ts.forEachChild(node, visit);
	}
	for (const tree of trees) {
		visit(tree);
	}
	return roots;
}
