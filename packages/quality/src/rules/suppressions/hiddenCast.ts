import ts from "typescript";

function concrete(type: ts.TypeNode | undefined): boolean {
	return type !== undefined && type.kind !== ts.SyntaxKind.UnknownKeyword;
}

function called(node: ts.Node, owner: string, method: string): node is ts.CallExpression {
	return (
		ts.isCallExpression(node)
		&& ts.isPropertyAccessExpression(node.expression)
		&& ts.isIdentifier(node.expression.expression)
		&& ownerName(node.expression.expression) === owner
		&& node.expression.name.text === method
	);
}

function ownerName(node: ts.Identifier): string {
	for (const statement of node.getSourceFile().statements) {
		if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))) {
			continue;
		}
		const bindings = statement.importClause?.namedBindings;
		if (bindings !== undefined && ts.isNamedImports(bindings)) {
			const imported = bindings.elements.find((element) => element.name.text === node.text);
			if (statement.moduleSpecifier.text === "effect" && imported !== undefined) {
				return imported.propertyName?.text ?? imported.name.text;
			}
		}
		if (
			bindings !== undefined
			&& ts.isNamespaceImport(bindings)
			&& bindings.name.text === node.text
			&& statement.moduleSpecifier.text === "effect/Context"
		) {
			return "Context";
		}
	}
	return node.text;
}

function unwrapped(node: ts.Expression): ts.Expression {
	return ts.isParenthesizedExpression(node) ? unwrapped(node.expression) : node;
}

function bindingCast(node: ts.Node): string | undefined {
	if (!ts.isVariableDeclaration(node) || node.initializer === undefined) {
		return undefined;
	}
	const value = unwrapped(node.initializer);
	if (called(value, "JSON", "parse") && concrete(node.type)) {
		return `Assigns JSON.parse directly to ${node.type?.getText()}. Keep the result unknown and use Schema.decodeUnknownEffect with a schema for that declared type.`;
	}
	if (called(value, "Reflect", "get") && node.type?.kind !== ts.SyntaxKind.UnknownKeyword) {
		return "Binds an unchecked Reflect.get result. Declare the result unknown and narrow it or use Schema.decodeUnknownEffect with the required schema.";
	}
	return undefined;
}

function hasMapUnsafe(node: ts.Node): boolean {
	return (ts.isPropertyAccessExpression(node) && node.name.text === "mapUnsafe") || ts.forEachChild(node, hasMapUnsafe) === true;
}

function identityOverload(node: ts.Node): string | undefined {
	if (!ts.isFunctionDeclaration(node) || node.body === undefined || node.type?.kind !== ts.SyntaxKind.UnknownKeyword || node.name === undefined) {
		return undefined;
	}
	const statement = node.body.statements[0];
	if (node.body.statements.length !== 1 || statement === undefined || !ts.isReturnStatement(statement) || statement.expression === undefined) {
		return undefined;
	}
	const returned = unwrapped(statement.expression);
	if (!(ts.isIdentifier(returned) && node.parameters.some((parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === returned.text))) {
		return undefined;
	}
	const siblings = ts.isSourceFile(node.parent) || ts.isBlock(node.parent) || ts.isModuleBlock(node.parent) ? node.parent.statements : [];
	const overload = siblings.find(
		(sibling) => ts.isFunctionDeclaration(sibling) && sibling.body === undefined && sibling.name?.text === node.name?.text && concrete(sibling.type),
	);
	return overload === undefined || !ts.isFunctionDeclaration(overload)
		? undefined
		: `An identity overload hides an unknown return value. Give the implementation the declared overload return type ${overload.type?.getText()} and let TypeScript check it; decode unknown input with Schema.decodeUnknownEffect.`;
}

export function hiddenCast(node: ts.Node): string | undefined {
	if (ts.isTaggedTemplateExpression(node) && node.typeArguments?.length && ts.isIdentifier(node.tag) && node.tag.text === "sql") {
		return SQL_ROW_CAST;
	}
	if (called(node, "Context", "makeUnsafe") && node.arguments.some(hasMapUnsafe)) {
		return "Retags a Context through mapUnsafe. Preserve its declared Context service type and use Context.add or Effect.provideService for the required services.";
	}
	return bindingCast(node) ?? identityOverload(node);
}

export const SQL_ROW_CAST =
	"Declares SQL rows with a generic instead of checking them. Use SqlSchema.findAll or SqlSchema.findOne with the declared row schema to decode the result.";
