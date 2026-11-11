import ts from "typescript";

const MUTATORS: ReadonlySet<string> = new Set([
	"add",
	"clear",
	"copyWithin",
	"delete",
	"fill",
	"pop",
	"push",
	"reverse",
	"set",
	"shift",
	"sort",
	"splice",
	"unshift",
]);

function receiver(expression: ts.Expression): string | undefined {
	if (ts.isIdentifier(expression)) {
		return expression.text;
	}
	return ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression) ? receiver(expression.expression) : undefined;
}

function changedThrough(node: ts.Node): ts.Expression | undefined {
	if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.getText() === "Object.assign") {
		return node.arguments[0];
	}
	if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && MUTATORS.has(node.expression.name.text)) {
		return node.expression.expression;
	}
	let assigned: ts.Expression | undefined;
	if (
		ts.isBinaryExpression(node)
		&& node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
		&& node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
	) {
		assigned = node.left;
	} else if (ts.isDeleteExpression(node)) {
		assigned = node.expression;
	} else if (
		(ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
		&& (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
	) {
		assigned = node.operand;
	}
	return assigned !== undefined && (ts.isPropertyAccessExpression(assigned) || ts.isElementAccessExpression(assigned))
		? assigned.expression
		: undefined;
}

export function mutatedBindings(tree: ts.SourceFile): ReadonlySet<string> {
	const names = new Set<string>();
	function visit(node: ts.Node): void {
		const target = changedThrough(node);
		const name = target === undefined ? undefined : receiver(target);
		if (name !== undefined) {
			names.add(name);
		}
		ts.forEachChild(node, visit);
	}
	visit(tree);
	return names;
}

export interface ImportedChange {
	readonly name: string;
	readonly specifier: string;
}

// Changing an imported container changes the exporting module's state, so the change belongs to the exported name.
export function importedChanges(tree: ts.SourceFile, changed: ReadonlySet<string>): readonly ImportedChange[] {
	return tree.statements.flatMap((statement) => {
		if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))) {
			return [];
		}
		const specifier = statement.moduleSpecifier.text;
		const bindings = statement.importClause?.namedBindings;
		return bindings !== undefined && ts.isNamedImports(bindings)
			? bindings.elements
					.filter((element) => changed.has(element.name.text))
					.map((element) => ({ name: (element.propertyName ?? element.name).text, specifier }))
			: [];
	});
}
