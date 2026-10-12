import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

export function decisionSites(root: string) {
	const sites: string[] = [];
	function scan(directory: string) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.name === "test-support") {
				continue;
			}
			const file = join(directory, entry.name);
			if (entry.isDirectory()) {
				scan(file);
				continue;
			}
			if (!entry.name.endsWith(".ts") || /\.(?:test|spec)\.ts$/u.test(entry.name)) {
				continue;
			}
			sites.push(...sourceDecisionSites(relative(root, file), readFileSync(file, "utf8")));
		}
	}
	scan(root);
	return sites.sort((left, right) => left.localeCompare(right));
}
export function sourceDecisionSites(file: string, source: string) {
	const sites: string[] = [];
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
	function add(node: ts.Node) {
		sites.push(`${file}: ${node.getText(tree).replace(/\s+/gu, " ")}`);
	}
	function creationReason(node: ts.CallExpression) {
		const expression = node.expression.getText(tree);
		if (expression === "decision" || expression === "state.decision") {
			return node.arguments[1];
		}
		return expression === "waitingDecision" ? node.arguments[0] : undefined;
	}
	function decisionField(node: ts.PropertyAssignment) {
		if (node.name.getText(tree) === "stage" && node.initializer.getText(tree) === '"needs-human"') {
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
