import ts from "typescript";

function calledName(expression: ts.LeftHandSideExpression, clause: ts.ImportClause): string | undefined {
	const bindings = clause.namedBindings;
	if (ts.isIdentifier(expression) && bindings !== undefined && ts.isNamedImports(bindings)) {
		const imported = bindings.elements.find((element) => element.name.text === expression.text);
		return imported === undefined ? undefined : (imported.propertyName ?? imported.name).text;
	}
	if (!(ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression))) {
		return undefined;
	}
	const namespace = bindings !== undefined && ts.isNamespaceImport(bindings) ? bindings.name.text : clause.name?.text;
	return namespace === expression.expression.text ? expression.name.text : undefined;
}

export function importedName(expression: ts.LeftHandSideExpression): { readonly module: string; readonly name: string } | undefined {
	for (const statement of expression.getSourceFile().statements) {
		if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) || statement.importClause === undefined) {
			continue;
		}
		const name = calledName(expression, statement.importClause);
		if (name !== undefined) {
			return { module: statement.moduleSpecifier.text, name };
		}
	}
	return undefined;
}

export function importedCall(call: ts.CallExpression): { readonly module: string; readonly name: string } | undefined {
	return importedName(call.expression);
}
