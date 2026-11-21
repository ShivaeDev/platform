import ts from "typescript";

export function foreignDeclaration(node: ts.Declaration): boolean {
	const file = node.getSourceFile().fileName.replaceAll("\\", "/");
	return file.includes("/node_modules/") && !/\/(?:effect|@effect|@shivaedev)\//u.test(file);
}

function methodTypes(checker: ts.TypeChecker, type: ts.Type | undefined, name: string): readonly ts.Type[] {
	if (type === undefined) {
		return [];
	}
	return (type.isUnionOrIntersection() ? type.types : [type]).flatMap((part) => {
		const property = part.getProperty(name);
		return property === undefined ? [] : [checker.getTypeOfSymbol(property)];
	});
}

function methodType(checker: ts.TypeChecker, type: ts.Type | undefined, name: string): ts.Type | undefined {
	return methodTypes(checker, type, name)[0];
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

function callbackSignatures(checker: ts.TypeChecker, type: ts.Type): readonly ts.Signature[] {
	const members = type.isUnionOrIntersection() ? type.types : [type];
	return members.flatMap((member) => {
		const callable = checker.getNonNullableType(member).getCallSignatures();
		if (callable.length > 0) {
			return callable;
		}
		const handler = member.getProperty("handler");
		return handler === undefined ? [] : callbackSignatures(checker, checker.getTypeOfSymbol(handler));
	});
}

function contextualCallbackTypes(checker: ts.TypeChecker, node: ts.Node): readonly ts.Type[] {
	if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		const contextual = checker.getContextualType(node);
		return contextual === undefined ? [] : [contextual];
	}
	if (!ts.isMethodDeclaration(node)) {
		return [];
	}
	if (ts.isObjectLiteralExpression(node.parent)) {
		return methodTypes(checker, checker.getContextualType(node.parent), methodName(node));
	}
	if (!ts.isClassLike(node.parent) || node.name === undefined) {
		return [];
	}
	return (node.parent.heritageClauses ?? [])
		.filter((clause) => clause.token === ts.SyntaxKind.ImplementsKeyword)
		.flatMap((clause) => clause.types)
		.flatMap((typeNode) => methodTypes(checker, checker.getTypeAtLocation(typeNode), methodName(node)));
}

export function foreignCallbackParameter(checker: ts.TypeChecker, parameter: ts.ParameterDeclaration): boolean {
	const fn = parameter.parent;
	if (
		contextualCallbackTypes(checker, fn).some((type) =>
			callbackSignatures(checker, type).some((signature) => signature.declaration !== undefined && foreignDeclaration(signature.declaration)),
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
