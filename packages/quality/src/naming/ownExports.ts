import ts from "typescript";
import { constantType, plainData } from "#naming/adapters/plainData.ts";

export interface OwnExport {
	readonly constant: boolean;
	readonly kind: "type" | "value";
	readonly name: string;
}

function isExported(statement: ts.Statement): boolean {
	const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
	return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function variables(statement: ts.VariableStatement): readonly OwnExport[] {
	const constant = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
	return statement.declarationList.declarations.flatMap((declaration) =>
		ts.isIdentifier(declaration.name)
			? [
					{
						constant: constant && plainData(declaration.initializer),
						kind: "value" as const,
						name: declaration.name.text,
					},
				]
			: [],
	);
}

function declared(statement: ts.Statement, constants: readonly string[] = []): readonly OwnExport[] {
	if (ts.isVariableStatement(statement)) {
		return variables(statement);
	}
	if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
		return [{ constant: ts.isTypeAliasDeclaration(statement) && constantType(statement.type, constants), kind: "type", name: statement.name.text }];
	}
	const named =
		ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement)
			? statement.name
			: undefined;
	return named !== undefined && ts.isIdentifier(named) ? [{ constant: false, kind: "value", name: named.text }] : [];
}

function ownDeclarations(source: ts.SourceFile): readonly OwnExport[] {
	const values = source.statements.flatMap((statement) => (ts.isVariableStatement(statement) ? variables(statement) : []));
	const constants = values.filter((entry) => entry.constant).map((entry) => entry.name);
	return source.statements.flatMap((statement) => declared(statement, constants));
}

function locals(source: ts.SourceFile): ReadonlyMap<string, OwnExport> {
	const all = ownDeclarations(source);
	return new Map(all.map((local) => [local.name, local]));
}

function listed(statement: ts.ExportDeclaration, known: ReadonlyMap<string, OwnExport>): readonly OwnExport[] {
	const clause = statement.exportClause;
	if (statement.moduleSpecifier !== undefined || clause === undefined || !ts.isNamedExports(clause)) {
		return [];
	}
	return clause.elements.flatMap((element) => {
		const local = known.get((element.propertyName ?? element.name).text);
		if (local === undefined) {
			return [];
		}
		const name = element.name.text === "default" ? local.name : element.name.text;
		const typeOnly = statement.isTypeOnly || element.isTypeOnly;
		return [{ constant: local.constant, kind: typeOnly ? ("type" as const) : local.kind, name }];
	});
}

function wrappedName(expression: ts.Expression): string | undefined {
	if (ts.isIdentifier(expression)) {
		return expression.text;
	}
	if (ts.isFunctionExpression(expression) || ts.isClassExpression(expression)) {
		return expression.name?.text;
	}
	if (ts.isCallExpression(expression)) {
		const [wrapped] = expression.arguments;
		return wrapped === undefined ? undefined : wrappedName(wrapped);
	}
	return ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)
		? wrappedName(expression.expression)
		: undefined;
}

// The default export counts under the name it resolves to, as in memo(ItemPanel); noDefaultExport reports the default export itself.
function defaulted(statement: ts.ExportAssignment, known: ReadonlyMap<string, OwnExport>): readonly OwnExport[] {
	const name = statement.isExportEquals ? undefined : wrappedName(statement.expression);
	if (name === undefined) {
		return [];
	}
	const local = known.get(name);
	return [{ constant: local?.constant === true && plainData(statement.expression), kind: local?.kind ?? "value", name }];
}

function exportsOf(statement: ts.Statement, known: ReadonlyMap<string, OwnExport>): readonly OwnExport[] {
	if (ts.isExportDeclaration(statement)) {
		return listed(statement, known);
	}
	if (ts.isExportAssignment(statement)) {
		return defaulted(statement, known);
	}
	return isExported(statement) ? declared(statement).map((entry) => known.get(entry.name) ?? entry) : [];
}

export function ownExports(source: ts.SourceFile): readonly OwnExport[] {
	const known = locals(source);
	const all = source.statements.flatMap((statement) => exportsOf(statement, known));
	return [...new Map(all.map((entry) => [`${entry.kind} ${entry.name}`, entry])).values()];
}
