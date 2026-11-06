import ts from "typescript";

function declaredValue(statements: readonly ts.Statement[], name: string): ts.Expression | undefined {
	for (const statement of statements) {
		if (!(ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const)) {
			continue;
		}
		const declaration = statement.declarationList.declarations.find((entry) => ts.isIdentifier(entry.name) && entry.name.text === name);
		if (declaration !== undefined) {
			return declaration.initializer;
		}
	}
	return undefined;
}

function initializer(node: ts.Identifier): ts.Expression | undefined {
	let scope: ts.Node | undefined = node.parent;
	while (scope !== undefined) {
		const value = ts.isSourceFile(scope) || ts.isBlock(scope) ? declaredValue(scope.statements, node.text) : undefined;
		if (value !== undefined) {
			return value;
		}
		scope = scope.parent;
	}
	return undefined;
}

export function buildEntryValue(node: ts.Expression, active: ReadonlySet<ts.Node> = new Set()): ts.Expression {
	if (active.has(node)) {
		return node;
	}
	const visited = new Set([...active, node]);
	if (ts.isIdentifier(node)) {
		const value = initializer(node);
		return value === undefined ? node : buildEntryValue(value, visited);
	}
	return ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)
		? buildEntryValue(node.expression, visited)
		: node;
}

export function buildOption(options: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
	for (const property of options.properties) {
		if (
			(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))
			&& property.name.getText().replace(/^["']|["']$/gu, "") === name
		) {
			return ts.isPropertyAssignment(property) ? property.initializer : property.name;
		}
	}
	return undefined;
}
