import ts from "typescript";
import { unwrapExpression } from "#adapters/serviceAssemblySyntax.ts";
import { ownExports } from "#naming/ownExports.ts";

const OPERATION_MODULE = "@shivaedev/contract/operation.ts";

const OPERATIONS = new Set(["command", "query"]);

function operationImports(statement: ts.Statement): readonly string[] {
	if (
		!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))
		|| statement.moduleSpecifier.text !== OPERATION_MODULE
		|| statement.importClause === undefined
		|| statement.importClause.isTypeOnly
	) {
		return [];
	}
	const bindings = statement.importClause.namedBindings;
	if (bindings === undefined || !ts.isNamedImports(bindings)) {
		return [];
	}
	return bindings.elements.flatMap((element) =>
		!element.isTypeOnly && OPERATIONS.has((element.propertyName ?? element.name).text) ? [element.name.text] : [],
	);
}

function declares(statement: ts.Statement, name: string, operations: ReadonlySet<string>): boolean {
	return (
		ts.isVariableStatement(statement)
		&& statement.declarationList.declarations.some((declaration) => {
			if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name || declaration.initializer === undefined) {
				return false;
			}
			const value = unwrapExpression(declaration.initializer);
			if (!ts.isCallExpression(value)) {
				return false;
			}
			const called = unwrapExpression(value.expression);
			return ts.isIdentifier(called) && operations.has(called.text);
		})
	);
}

export function isOperationFile(source: ts.SourceFile): boolean {
	const exports = ownExports(source);
	const [only] = exports;
	if (exports.length !== 1 || only === undefined || only.kind !== "value") {
		return false;
	}
	const operations = new Set(source.statements.flatMap(operationImports));
	return operations.size > 0 && source.statements.some((statement) => declares(statement, only.name, operations));
}
