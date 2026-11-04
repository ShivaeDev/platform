import ts from "typescript";
import { storyBody } from "#adapters/bodyReferences.ts";

export function storyUsesInputs(body: ts.Expression, checker: ts.TypeChecker): boolean | undefined {
	const declaration = storyBody(body, checker);
	if (declaration?.body === undefined) {
		return undefined;
	}
	const inputs = new Set<ts.Symbol>();
	function bind(name: ts.BindingName): void {
		if (ts.isIdentifier(name)) {
			const symbol = checker.getSymbolAtLocation(name);
			if (symbol !== undefined) {
				inputs.add(symbol);
			}
		} else {
			for (const element of name.elements) {
				if (ts.isBindingElement(element)) {
					bind(element.name);
				}
			}
		}
	}
	for (const parameter of declaration.parameters.slice(0, 2)) {
		bind(parameter.name);
	}
	function references(node: ts.Node): boolean {
		if (ts.isIdentifier(node)) {
			const symbol = ts.isShorthandPropertyAssignment(node.parent)
				? checker.getShorthandAssignmentValueSymbol(node.parent)
				: checker.getSymbolAtLocation(node);
			if (symbol !== undefined && inputs.has(symbol)) {
				return true;
			}
		}
		return ts.forEachChild(node, references) ?? false;
	}
	return references(declaration.body);
}
