import ts from "typescript";

function importedReference(declaration: ts.Declaration): string | undefined {
	if (ts.isImportSpecifier(declaration)) {
		const module = declaration.parent.parent.parent.moduleSpecifier;
		return ts.isStringLiteral(module) ? `${module.text}.${(declaration.propertyName ?? declaration.name).text}` : undefined;
	}
	if (ts.isNamespaceImport(declaration) || ts.isImportClause(declaration)) {
		const module = ts.isNamespaceImport(declaration) ? declaration.parent.parent.moduleSpecifier : declaration.parent.moduleSpecifier;
		return ts.isStringLiteral(module) ? module.text : undefined;
	}
	return undefined;
}

function memberName(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | undefined {
	if (ts.isPropertyAccessExpression(node)) {
		return node.name.text;
	}
	return ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined;
}

function bindingReference(checker: ts.TypeChecker, declaration: ts.Declaration, seen: Set<ts.Symbol>): string | undefined {
	if (!(ts.isBindingElement(declaration) && ts.isObjectBindingPattern(declaration.parent))) {
		return undefined;
	}
	const variable = declaration.parent.parent;
	const name = declaration.propertyName ?? declaration.name;
	if (!ts.isVariableDeclaration(variable) || variable.initializer === undefined || !(ts.isIdentifier(name) || ts.isStringLiteral(name))) {
		return undefined;
	}
	const owner = boundaryReference(checker, variable.initializer, seen);
	return owner === undefined ? undefined : `${owner}.${name.text}`;
}

function symbolReference(checker: ts.TypeChecker, node: ts.Identifier, seen: Set<ts.Symbol>): string | undefined {
	const symbol = checker.getSymbolAtLocation(node);
	if (symbol === undefined) {
		return node.text;
	}
	if (seen.has(symbol)) {
		return undefined;
	}
	seen.add(symbol);
	for (const declaration of symbol.declarations ?? []) {
		if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
			return boundaryReference(checker, declaration.initializer, seen);
		}
		const imported = importedReference(declaration) ?? bindingReference(checker, declaration, seen);
		if (imported !== undefined) {
			return imported;
		}
	}
	return symbol.declarations?.some((declaration) => !declaration.getSourceFile().isDeclarationFile) ? undefined : node.text;
}

export function boundaryReference(checker: ts.TypeChecker, node: ts.Node, seen = new Set<ts.Symbol>()): string | undefined {
	if (ts.isParenthesizedExpression(node)) {
		return boundaryReference(checker, node.expression, seen);
	}
	if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
		const member = memberName(node);
		const owner = boundaryReference(checker, node.expression, seen);
		return owner === undefined || member === undefined ? undefined : `${owner}.${member}`;
	}
	return ts.isIdentifier(node) ? symbolReference(checker, node, seen) : undefined;
}

export function boundaryEntryPoint(path: string, source: ts.SourceFile, checker: ts.TypeChecker): boolean {
	if (/(?:^|\/)(?:cli|main|[^/]+-cli)\.[cm]?[jt]sx?$|\.(?:config|test|spec)\.[cm]?[jt]sx?$/u.test(path)) {
		return true;
	}
	function visit(node: ts.Node): boolean {
		if (ts.isCallExpression(node)) {
			const reference = boundaryReference(checker, node.expression);
			if (reference?.endsWith(".runMain") || (ts.isIdentifier(node.expression) && node.expression.text === "runMain")) {
				return true;
			}
		}
		if (ts.isBinaryExpression(node) && node.getText(source).replace(/\s/gu, "") === "fileURLToPath(import.meta.url)===process.argv[1]") {
			return true;
		}
		return ts.forEachChild(node, visit) ?? false;
	}
	return visit(source);
}
