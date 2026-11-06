import ts from "typescript";

const CONSTANT_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;

const LITERALS: ReadonlySet<ts.SyntaxKind> = new Set([
	ts.SyntaxKind.BigIntLiteral,
	ts.SyntaxKind.FalseKeyword,
	ts.SyntaxKind.NoSubstitutionTemplateLiteral,
	ts.SyntaxKind.NullKeyword,
	ts.SyntaxKind.NumericLiteral,
	ts.SyntaxKind.RegularExpressionLiteral,
	ts.SyntaxKind.StringLiteral,
	ts.SyntaxKind.TrueKeyword,
]);

export function plainData(node: ts.Expression | undefined): boolean {
	if (node === undefined) {
		return false;
	}
	if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) {
		return plainData(node.expression);
	}
	if (ts.isIdentifier(node)) {
		return CONSTANT_CASE.test(node.text);
	}
	if (ts.isPrefixUnaryExpression(node)) {
		return (
			(node.operator === ts.SyntaxKind.PlusToken || node.operator === ts.SyntaxKind.MinusToken)
			&& (ts.isNumericLiteral(node.operand) || ts.isBigIntLiteral(node.operand))
		);
	}
	if (ts.isArrayLiteralExpression(node)) {
		return node.elements.every(plainData);
	}
	if (ts.isObjectLiteralExpression(node)) {
		return node.properties.every((property) =>
			ts.isPropertyAssignment(property)
				? !ts.isComputedPropertyName(property.name) && plainData(property.initializer)
				: ts.isShorthandPropertyAssignment(property) && CONSTANT_CASE.test(property.name.text),
		);
	}
	return LITERALS.has(node.kind);
}

export function constantType(node: ts.TypeNode, constants: readonly string[]): boolean {
	let queries = 0;
	let valid = true;
	function visit(child: ts.Node): void {
		if (ts.isTypeQueryNode(child)) {
			queries += 1;
			let name = child.exprName;
			while (ts.isQualifiedName(name)) {
				name = name.left;
			}
			valid &&= constants.includes(name.text);
		} else {
			ts.forEachChild(child, visit);
		}
	}
	visit(node);
	return valid && queries > 0;
}

export function knownDataExports(source: ts.SourceFile, names: readonly string[]): boolean {
	return source.statements.every((statement) => {
		if (ts.isExportDeclaration(statement)) {
			return (
				statement.moduleSpecifier === undefined
				&& statement.exportClause !== undefined
				&& ts.isNamedExports(statement.exportClause)
				&& statement.exportClause.elements.every((entry) =>
					names.includes(entry.name.text === "default" ? (entry.propertyName ?? entry.name).text : entry.name.text),
				)
			);
		}
		if (ts.isExportAssignment(statement)) {
			return plainData(statement.expression);
		}
		const exported = ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
		if (!exported) {
			return true;
		}
		if (ts.isVariableStatement(statement)) {
			return statement.declarationList.declarations.every((entry) => ts.isIdentifier(entry.name));
		}
		return !(ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement));
	});
}
