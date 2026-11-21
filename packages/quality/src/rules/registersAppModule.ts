import ts from "typescript";
import type { ImportBinding } from "#rules/stories/importBindings.ts";

const APP_MODULE = "@shivaedev/server/AppModule.ts";

// Build's generator lists this syntax in the server's module list, so the value is a registration it consumes, not a second name.
export function registersAppModule(node: ts.Expression, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	if (ts.isParenthesizedExpression(node)) {
		return registersAppModule(node.expression, bindings);
	}
	if (!(ts.isSatisfiesExpression(node) && ts.isTypeReferenceNode(node.type))) {
		return false;
	}
	const { typeName } = node.type;
	const named = ts.isIdentifier(typeName) ? bindings.get(typeName.text) : undefined;
	const namespace =
		ts.isQualifiedName(typeName) && ts.isIdentifier(typeName.left) && typeName.right.text === "AppModule"
			? bindings.get(typeName.left.text)
			: undefined;
	return (named?.imported === "AppModule" && named.module === APP_MODULE) || (namespace?.imported === "*" && namespace.module === APP_MODULE);
}
