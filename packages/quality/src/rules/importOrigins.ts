import ts from "typescript";

export function importOrigins(source: ts.SourceFile): ReadonlyMap<string, string> {
	const origins = new Map<string, string>();
	for (const statement of source.statements) {
		if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))) {
			continue;
		}
		const clause = statement.importClause;
		const names = clause?.namedBindings;
		if (clause?.name !== undefined) {
			origins.set(clause.name.text, statement.moduleSpecifier.text);
		}
		if (names !== undefined) {
			for (const name of ts.isNamespaceImport(names) ? [names.name] : names.elements.map((element) => element.name)) {
				origins.set(name.text, statement.moduleSpecifier.text);
			}
		}
	}
	return origins;
}

export function originOf(node: ts.Node, origins: ReadonlyMap<string, string>): string | undefined {
	if (ts.isIdentifier(node)) {
		return origins.get(node.text);
	}
	if (ts.isPropertyAccessExpression(node)) {
		return originOf(node.expression, origins);
	}
	return undefined;
}
