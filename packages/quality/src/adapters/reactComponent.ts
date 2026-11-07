import ts from "typescript";
import { browserLibraryType } from "#adapters/browserLibraryType.ts";

function reactResult(type: ts.Type): boolean {
	const named = [type.getSymbol(), type.aliasSymbol].some(
		(symbol) =>
			["ReactNode", "ReactElement", "Element", "ReactPortal"].includes(symbol?.name ?? "")
			&& (symbol?.declarations ?? []).some((declaration) =>
				/\/node_modules\/(?:@types\/)?react\//u.test(declaration.getSourceFile().fileName.replaceAll("\\", "/")),
			),
	);
	if (named || !type.isUnion()) {
		return named;
	}
	const elements = type.types.filter(
		(part) =>
			!(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike)),
	);
	return elements.length > 0 && elements.every(reactResult);
}

export function reactComponent(checker: ts.TypeChecker, node: ts.Node): boolean {
	if (!(ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) || node.parameters.length !== 1) {
		return false;
	}
	const declaration = ts.isVariableDeclaration(node.parent) ? node.parent : node;
	const name = declaration.name;
	const statement = ts.isVariableDeclaration(declaration) ? declaration.parent.parent : declaration;
	if (name === undefined || !ts.isIdentifier(name) || !/^[A-Z]/u.test(name.text) || !ts.isSourceFile(statement.parent)) {
		return false;
	}
	const signature = checker.getSignatureFromDeclaration(node);
	return signature !== undefined && reactResult(signature.getReturnType());
}

function propSignature(signature: ts.Signature): readonly ts.ParameterDeclaration[] {
	const declaration = signature.declaration;
	return declaration !== undefined
		&& (ts.isFunctionTypeNode(declaration) || ts.isMethodSignature(declaration) || ts.isCallSignatureDeclaration(declaration))
		? declaration.parameters
		: [];
}

export function reactPropParameters(checker: ts.TypeChecker, sources: readonly ts.SourceFile[]): ReadonlySet<ts.ParameterDeclaration> {
	const parameters = new Set<ts.ParameterDeclaration>();
	const seen = new Set<ts.Type>();
	function props(type: ts.Type): void {
		if (seen.has(type) || browserLibraryType(type)) {
			return;
		}
		seen.add(type);
		for (const signature of type.getCallSignatures()) {
			for (const parameter of propSignature(signature)) {
				parameters.add(parameter);
			}
		}
		if (type.isUnionOrIntersection()) {
			type.types.forEach(props);
		}
		for (const property of type.getProperties()) {
			props(checker.getTypeOfSymbol(property));
		}
	}
	function visit(node: ts.Node): void {
		if (reactComponent(checker, node) && ts.isFunctionLike(node) && node.parameters[0] !== undefined) {
			props(checker.getTypeAtLocation(node.parameters[0]));
		}
		ts.forEachChild(node, visit);
	}
	sources.forEach(visit);
	return parameters;
}
