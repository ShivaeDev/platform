import ts from "typescript";
import { ownExports } from "#naming/ownExports.ts";
import { unwrapExpression } from "#serviceAssemblySyntax.ts";

function callImports(statement: ts.Statement, module: string, callees: ReadonlySet<string>): readonly string[] {
	if (
		!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))
		|| statement.moduleSpecifier.text !== module
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
		!element.isTypeOnly && callees.has((element.propertyName ?? element.name).text) ? [element.name.text] : [],
	);
}

function declares(statement: ts.Statement, name: string, imported: ReadonlySet<string>): boolean {
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
			return ts.isIdentifier(called) && imported.has(called.text);
		})
	);
}

// A file whose one export is a call of a function imported by name from module, such as an operation or a client module.
export function exportsOnlyCallOf(source: ts.SourceFile, module: string, callees: ReadonlySet<string>): boolean {
	const exports = ownExports(source);
	const [only] = exports;
	if (exports.length !== 1 || only === undefined || only.kind !== "value") {
		return false;
	}
	const imported = new Set(source.statements.flatMap((statement) => callImports(statement, module, callees)));
	return imported.size > 0 && source.statements.some((statement) => declares(statement, only.name, imported));
}
