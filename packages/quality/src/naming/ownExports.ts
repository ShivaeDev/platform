import ts from "typescript";

export interface OwnExport {
	readonly constant: boolean;
	readonly kind: "type" | "value";
	readonly name: string;
}

const CONSTANT_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;

const PRIMITIVE_LITERALS: ReadonlySet<ts.SyntaxKind> = new Set([
	ts.SyntaxKind.BigIntLiteral,
	ts.SyntaxKind.FalseKeyword,
	ts.SyntaxKind.NoSubstitutionTemplateLiteral,
	ts.SyntaxKind.NumericLiteral,
	ts.SyntaxKind.StringLiteral,
	ts.SyntaxKind.TrueKeyword,
]);

function isPrimitiveLiteral(node: ts.Expression | undefined): boolean {
	if (node === undefined) {
		return false;
	}
	if (ts.isPrefixUnaryExpression(node)) {
		return isPrimitiveLiteral(node.operand);
	}
	return PRIMITIVE_LITERALS.has(node.kind);
}

function isExported(statement: ts.Statement): boolean {
	const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
	const exported = modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
	const isDefault = modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
	return exported && !isDefault;
}

function variables(statement: ts.VariableStatement): readonly OwnExport[] {
	const constant = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
	return statement.declarationList.declarations.flatMap((declaration) =>
		ts.isIdentifier(declaration.name)
			? [
					{
						constant: constant && (CONSTANT_CASE.test(declaration.name.text) || isPrimitiveLiteral(declaration.initializer)),
						kind: "value" as const,
						name: declaration.name.text,
					},
				]
			: [],
	);
}

function declared(statement: ts.Statement): readonly OwnExport[] {
	if (ts.isVariableStatement(statement)) {
		return variables(statement);
	}
	if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
		return [{ constant: false, kind: "type", name: statement.name.text }];
	}
	const named =
		ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement)
			? statement.name
			: undefined;
	return named !== undefined && ts.isIdentifier(named) ? [{ constant: false, kind: "value", name: named.text }] : [];
}

function locals(source: ts.SourceFile): ReadonlyMap<string, OwnExport> {
	const all = source.statements.flatMap(declared);
	return new Map(all.map((local) => [local.name, local]));
}

function listed(statement: ts.ExportDeclaration, known: ReadonlyMap<string, OwnExport>): readonly OwnExport[] {
	const clause = statement.exportClause;
	if (statement.moduleSpecifier !== undefined || clause === undefined || !ts.isNamedExports(clause)) {
		return [];
	}
	return clause.elements.flatMap((element) => {
		const name = element.name.text;
		const local = known.get((element.propertyName ?? element.name).text);
		if (name === "default" || local === undefined) {
			return [];
		}
		const typeOnly = statement.isTypeOnly || element.isTypeOnly;
		return [{ constant: local.constant, kind: typeOnly ? ("type" as const) : local.kind, name }];
	});
}

export function ownExports(source: ts.SourceFile): readonly OwnExport[] {
	const known = locals(source);
	return source.statements.flatMap((statement) => {
		if (ts.isExportDeclaration(statement)) {
			return listed(statement, known);
		}
		return isExported(statement) ? declared(statement) : [];
	});
}
