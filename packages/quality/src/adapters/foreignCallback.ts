import ts from "typescript";

export function foreignDeclaration(node: ts.Declaration): boolean {
	const file = node.getSourceFile().fileName.replaceAll("\\", "/");
	return file.includes("/node_modules/") && !/\/(?:effect|@effect|@shivaedev)\//u.test(file);
}

function methodType(checker: ts.TypeChecker, type: ts.Type | undefined, name: string): ts.Type | undefined {
	if (type === undefined) {
		return undefined;
	}
	const property = (type.isUnionOrIntersection() ? type.types : [type])
		.map((part) => part.getProperty(name))
		.find((candidate) => candidate !== undefined);
	return property === undefined ? undefined : checker.getTypeOfSymbol(property);
}

function methodName(node: ts.MethodDeclaration): string {
	return node.name.getText().replace(/^['"]|['"]$/gu, "");
}

function implementedMethodType(checker: ts.TypeChecker, node: ts.MethodDeclaration): ts.Type | undefined {
	if (!ts.isClassLike(node.parent) || node.name === undefined) {
		return undefined;
	}
	for (const typeNode of (node.parent.heritageClauses ?? [])
		.filter((clause) => clause.token === ts.SyntaxKind.ImplementsKeyword)
		.flatMap((clause) => clause.types)) {
		const type = methodType(checker, checker.getTypeAtLocation(typeNode), methodName(node));
		if (type !== undefined) {
			return type;
		}
	}
	return undefined;
}

export function contextualCallbackType(checker: ts.TypeChecker, node: ts.Node): ts.Type | undefined {
	if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		return checker.getContextualType(node);
	}
	if (!ts.isMethodDeclaration(node)) {
		return undefined;
	}
	if (ts.isObjectLiteralExpression(node.parent)) {
		return methodType(checker, checker.getContextualType(node.parent), methodName(node));
	}
	return implementedMethodType(checker, node);
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
