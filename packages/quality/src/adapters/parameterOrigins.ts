import ts from "typescript";
import { resolvedValue } from "#adapters/serviceModelSyntax.ts";

export function parameterOrigins(checker: ts.TypeChecker, sources: readonly ts.SourceFile[]) {
	let calls: Map<ts.ParameterDeclaration, (ts.Expression | undefined)[]> | undefined;
	function argumentsIn() {
		if (calls !== undefined) {
			return calls;
		}
		const arguments_ = new Map<ts.ParameterDeclaration, (ts.Expression | undefined)[]>();
		function visit(node: ts.Node): void {
			if (ts.isCallExpression(node)) {
				const declaration = checker.getResolvedSignature(node)?.declaration;
				for (const [index, parameter] of (declaration?.parameters ?? []).entries()) {
					const argument = node.arguments[index];
					if (ts.isParameter(parameter)) {
						const values = arguments_.get(parameter) ?? [];
						values.push(argument);
						arguments_.set(parameter, values);
					}
				}
			}
			ts.forEachChild(node, visit);
		}
		for (const source of sources) {
			visit(source);
		}
		calls = arguments_;
		return arguments_;
	}
	return (parameter: ts.ParameterDeclaration, accepts: (value: ts.Node) => boolean): boolean => originates(checker, parameter, accepts, argumentsIn);
}

function originates(
	checker: ts.TypeChecker,
	node: ts.Node,
	accepts: (value: ts.Node) => boolean,
	argumentsIn: () => ReadonlyMap<ts.ParameterDeclaration, readonly (ts.Expression | undefined)[]>,
	seen: ReadonlySet<ts.Node> = new Set(),
): boolean {
	if (seen.has(node)) {
		return false;
	}
	if (accepts(node)) {
		return true;
	}
	const visited = new Set([...seen, node]);
	if (ts.isExpression(node)) {
		const value = resolvedValue(checker, node);
		if (value !== node) {
			return originates(checker, value, accepts, argumentsIn, visited);
		}
	}
	const declared = ts.isIdentifier(node) ? checker.getSymbolAtLocation(node)?.valueDeclaration : node;
	if (declared === undefined || !ts.isParameter(declared)) {
		return false;
	}
	const values = argumentsIn().get(declared) ?? [];
	return values.length > 0 && values.every((value) => value !== undefined && originates(checker, value, accepts, argumentsIn, visited));
}
