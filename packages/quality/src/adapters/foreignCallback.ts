import ts from "typescript";

export function foreignDeclaration(node: ts.Declaration): boolean {
	const file = node.getSourceFile().fileName.replaceAll("\\", "/");
	return file.includes("/node_modules/") && !/\/(?:effect|@effect|@shivaedev)\//u.test(file);
}

export function contextualCallbackType(checker: ts.TypeChecker, node: ts.Node): ts.Type | undefined {
	if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		return checker.getContextualType(node);
	}
	if (ts.isMethodDeclaration(node) && ts.isObjectLiteralExpression(node.parent)) {
		const object = checker.getContextualType(node.parent);
		const property = object?.getProperty(node.name.getText().replace(/^["']|["']$/gu, ""));
		return property === undefined ? undefined : checker.getTypeOfSymbol(property);
	}
	return undefined;
}

export function foreignCallbackParameter(checker: ts.TypeChecker, parameter: ts.ParameterDeclaration): boolean {
	const fn = parameter.parent;
	const context = contextualCallbackType(checker, fn);
	if (
		(context === undefined ? [] : checker.getNonNullableType(context).getCallSignatures()).some(
			(signature) => signature.declaration !== undefined && foreignDeclaration(signature.declaration),
		)
	) {
		return true;
	}
	if (!((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isCallExpression(fn.parent) && fn.parent.arguments.includes(fn))) {
		return false;
	}
	const owner = checker.getResolvedSignature(fn.parent);
	return owner?.declaration !== undefined && foreignDeclaration(owner.declaration);
}
