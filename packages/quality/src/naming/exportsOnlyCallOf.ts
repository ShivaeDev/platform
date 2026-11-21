import ts from "typescript";
import { ownExports } from "#naming/ownExports.ts";
import { unwrapExpression } from "#serviceAssemblySyntax.ts";

interface CallImports {
	readonly named: ReadonlySet<string>;
	readonly namespaces: ReadonlySet<string>;
}

function importedBindings(statement: ts.Statement, module: string): ts.NamedImportBindings | undefined {
	if (
		!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))
		|| statement.moduleSpecifier.text !== module
		|| statement.importClause === undefined
		|| statement.importClause.isTypeOnly
	) {
		return undefined;
	}
	return statement.importClause.namedBindings;
}

function callImports(source: ts.SourceFile, module: string, callees: ReadonlySet<string>): CallImports {
	const bindings = source.statements.flatMap((statement) => importedBindings(statement, module) ?? []);
	return {
		named: new Set(
			bindings.flatMap((binding) =>
				ts.isNamedImports(binding)
					? binding.elements.flatMap((element) =>
							!element.isTypeOnly && callees.has((element.propertyName ?? element.name).text) ? [element.name.text] : [],
						)
					: [],
			),
		),
		namespaces: new Set(bindings.flatMap((binding) => (ts.isNamespaceImport(binding) ? [binding.name.text] : []))),
	};
}

function callsImported(called: ts.Expression, imported: CallImports, callees: ReadonlySet<string>): boolean {
	if (ts.isIdentifier(called)) {
		return imported.named.has(called.text);
	}
	return (
		ts.isPropertyAccessExpression(called)
		&& ts.isIdentifier(called.expression)
		&& imported.namespaces.has(called.expression.text)
		&& callees.has(called.name.text)
	);
}

function declares(statement: ts.Statement, name: string, imported: CallImports, callees: ReadonlySet<string>): boolean {
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
			return callsImported(unwrapExpression(value.expression), imported, callees);
		})
	);
}

// A file whose one export is a call of a function imported from module, by name or through a namespace, such as an operation or a client module.
export function exportsOnlyCallOf(source: ts.SourceFile, module: string, callees: ReadonlySet<string>): boolean {
	const exports = ownExports(source);
	const [only] = exports;
	if (exports.length !== 1 || only === undefined || only.kind !== "value") {
		return false;
	}
	const imported = callImports(source, module, callees);
	return source.statements.some((statement) => declares(statement, only.name, imported, callees));
}
