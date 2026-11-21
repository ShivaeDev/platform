import ts from "typescript";

export interface ExportedVariable {
	readonly name: string;
	readonly variable: ts.VariableDeclaration;
}

function isExported(statement: ts.Statement): boolean {
	return ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;
}

function declaredVariables(statement: ts.Statement): readonly (readonly [string, ts.VariableDeclaration])[] {
	return ts.isVariableStatement(statement)
		? statement.declarationList.declarations.flatMap((variable) => (ts.isIdentifier(variable.name) ? [[variable.name.text, variable] as const] : []))
		: [];
}

// Both `export const` and a separate `export { local as name }` export a variable; the list imports it by its exported name.
export function exportedVariables(source: ts.SourceFile): readonly ExportedVariable[] {
	const declared = new Map(source.statements.flatMap(declaredVariables));
	const direct = source.statements
		.filter(isExported)
		.flatMap((statement) => declaredVariables(statement).map(([name, variable]) => ({ name, variable })));
	const listed = source.statements.flatMap((statement) =>
		ts.isExportDeclaration(statement)
		&& statement.moduleSpecifier === undefined
		&& statement.exportClause !== undefined
		&& ts.isNamedExports(statement.exportClause)
			? statement.exportClause.elements.flatMap((element) => {
					const variable = declared.get((element.propertyName ?? element.name).text);
					return variable === undefined ? [] : [{ name: element.name.text, variable }];
				})
			: [],
	);
	return [...direct, ...listed];
}

export function exportsAnything(source: ts.SourceFile): boolean {
	return source.statements.some((statement) => isExported(statement) || ts.isExportDeclaration(statement) || ts.isExportAssignment(statement));
}
