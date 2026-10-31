import ts from "typescript";

function propertyName(node: ts.Expression, checker: ts.TypeChecker): string | undefined {
	if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) {
		return node.text;
	}
	const type = checker.getTypeAtLocation(node);
	return type.isStringLiteral() || type.isNumberLiteral() ? String(type.value) : undefined;
}

function readonlyProperty(checker: ts.TypeChecker, target: ts.Expression, key: string): boolean {
	const type = checker.getTypeAtLocation(target);
	if (type.isUnionOrIntersection()) {
		return type.types.some((part) => readonlyIn(part, key));
	}
	return readonlyIn(type, key);
}

function readonlyIn(type: ts.Type, key: string): boolean {
	const symbol = type.getProperty(key);
	const mapped = type.getSymbol()?.getDeclarations()?.find(ts.isMappedTypeNode);
	if (symbol !== undefined && mapped?.readonlyToken !== undefined) {
		return mapped.readonlyToken.kind !== ts.SyntaxKind.MinusToken;
	}
	return (
		symbol
			?.getDeclarations()
			?.some(
				(declaration) =>
					(ts.canHaveModifiers(declaration) && ts.getModifiers(declaration)?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword))
					|| (ts.isGetAccessorDeclaration(declaration) && !symbol.getDeclarations()?.some(ts.isSetAccessorDeclaration)),
			) === true
	);
}

function scopeState(checker: ts.TypeChecker, target: ts.Expression, key: string): boolean {
	if (key !== "state") {
		return false;
	}
	return (
		checker
			.getTypeAtLocation(target)
			.getProperty("state")
			?.getDeclarations()
			?.some((declaration) => /(?:^|\/)effect\/(?:src|dist(?:\/[^/]+)?)\/Scope\.(?:d\.)?ts$/u.test(declaration.getSourceFile().fileName)) === true
	);
}

function overwritten(checker: ts.TypeChecker, target: ts.Expression, keys: readonly string[]): string | undefined {
	const key = keys.find((name) => readonlyProperty(checker, target, name) || scopeState(checker, target, name));
	return key === undefined
		? undefined
		: `Writes ${key} on ${checker.typeToString(checker.getTypeAtLocation(target))}. Use the native constructor or copy API and preserve the declared readonly type; use Scope.close for Scope state.`;
}

function assignedKeys(checker: ts.TypeChecker, source: ts.Expression): readonly string[] {
	return checker
		.getTypeAtLocation(source)
		.getProperties()
		.map((property) => property.name);
}

function writeTarget(node: ts.Node): ts.Expression | undefined {
	if (
		ts.isBinaryExpression(node)
		&& node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
		&& node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
	) {
		return node.left;
	}
	if (
		(ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
		&& (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
	) {
		return node.operand;
	}
	return ts.isDeleteExpression(node) ? node.expression : undefined;
}

export function writeCandidate(node: ts.Node): boolean {
	const target = writeTarget(node);
	return (
		(target !== undefined
			&& (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target))
			&& !constructorInitialization(node, target.expression))
		|| (ts.isCallExpression(node)
			&& ts.isPropertyAccessExpression(node.expression)
			&& ts.isIdentifier(node.expression.expression)
			&& ((node.expression.expression.text === "Object" && ["assign", "defineProperty"].includes(node.expression.name.text))
				|| (node.expression.expression.text === "Reflect" && node.expression.name.text === "set")))
	);
}

function constructorInitialization(node: ts.Node, target: ts.Expression | undefined): boolean {
	if (target?.kind !== ts.SyntaxKind.ThisKeyword) {
		return false;
	}
	for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
		if (ts.isConstructorDeclaration(parent)) {
			return true;
		}
		if (ts.isFunctionLike(parent)) {
			break;
		}
	}
	return false;
}

function callWrite(node: ts.CallExpression, checker: ts.TypeChecker): string | undefined {
	const target = node.arguments[0];
	if (target === undefined || constructorInitialization(node, target)) {
		return undefined;
	}
	const method = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : undefined;
	if (method === "assign") {
		return overwritten(
			checker,
			target,
			node.arguments.slice(1).flatMap((source) => assignedKeys(checker, source)),
		);
	}
	const argument = node.arguments[1];
	const key = argument === undefined ? undefined : propertyName(argument, checker);
	return key === undefined ? undefined : overwritten(checker, target, [key]);
}

export function readonlyWrite(node: ts.Node, checker: ts.TypeChecker): string | undefined {
	if (ts.isCallExpression(node)) {
		return callWrite(node, checker);
	}
	const target = writeTarget(node);
	if (target === undefined || !(ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target))) {
		return undefined;
	}
	if (constructorInitialization(node, target.expression)) {
		return undefined;
	}
	const key = ts.isPropertyAccessExpression(target) ? target.name.text : propertyName(target.argumentExpression, checker);
	return key === undefined ? undefined : overwritten(checker, target.expression, [key]);
}
