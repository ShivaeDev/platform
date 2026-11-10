import ts from "typescript";

export interface ModuleCall {
	readonly definition: ts.Expression | undefined;
	readonly exported: boolean;
	readonly variable: ts.VariableDeclaration;
}

function importsDefineModule(source: ts.SourceFile): ReadonlySet<string> {
	const locals = new Set<string>();
	for (const statement of source.statements) {
		const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined;
		if (bindings !== undefined && ts.isNamedImports(bindings)) {
			for (const element of bindings.elements) {
				if ((element.propertyName ?? element.name).text === "defineModule") {
					locals.add(element.name.text);
				}
			}
		}
	}
	return locals;
}

// Found by syntax alone, so discovery and the cache need no program.
export function moduleCalls(source: ts.SourceFile): readonly ModuleCall[] {
	const locals = importsDefineModule(source);
	if (locals.size === 0) {
		return [];
	}
	return source.statements.flatMap((statement) => {
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;
		return statement.declarationList.declarations.flatMap((variable) => {
			const call = variable.initializer;
			return call !== undefined && ts.isCallExpression(call) && ts.isIdentifier(call.expression) && locals.has(call.expression.text)
				? [{ definition: call.arguments[0], exported, variable }]
				: [];
		});
	});
}

export function propertyOf(literal: ts.ObjectLiteralExpression, name: string): ts.ObjectLiteralElementLike | undefined {
	return literal.properties.find(
		(property) => property.name !== undefined && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === name,
	);
}

export function initializerOf(property: ts.ObjectLiteralElementLike | undefined): ts.Expression | undefined {
	if (property === undefined) {
		return undefined;
	}
	if (ts.isPropertyAssignment(property)) {
		return property.initializer;
	}
	return ts.isShorthandPropertyAssignment(property) ? property.name : undefined;
}
