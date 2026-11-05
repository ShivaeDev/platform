import ts from "typescript";
import { importFrom } from "#rules/stories/importOrigin.ts";
import { memberName, nodesWhere, unwrapped } from "#rules/stories/syntax.ts";

const READERS = new Set(["String", "NonEmptyString", "Redacted", "URL", "string", "nonEmptyString", "redacted", "url"]);

function importedReference(node: ts.Node): readonly string[] | undefined {
	const from = importFrom(node);
	if (from === undefined) {
		return undefined;
	}
	if (ts.isImportSpecifier(node)) {
		return [from, (node.propertyName ?? node.name).text];
	}
	if (ts.isNamespaceImport(node) || (ts.isImportClause(node) && (from === "node:process" || from === "process"))) {
		return [from];
	}
	return undefined;
}

function bindingName(node: ts.BindingElement): string | undefined {
	const name = node.propertyName ?? node.name;
	return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined;
}

export function databaseUrlReads(source: ts.SourceFile, checker: ts.TypeChecker): readonly ts.Node[] {
	const visiting = new Set<ts.Node>();
	function declaration(node: ts.Node): readonly string[] | undefined {
		if (ts.isVariableDeclaration(node) && node.initializer !== undefined && (node.parent.flags & ts.NodeFlags.Const) !== 0) {
			return value(node.initializer);
		}
		if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent) && ts.isVariableDeclaration(node.parent.parent)) {
			const base = declaration(node.parent.parent);
			const name = bindingName(node);
			return base !== undefined && name !== undefined ? [...base, name] : undefined;
		}
		return importedReference(node);
	}
	function value(expression: ts.Expression): readonly string[] | undefined {
		const node = unwrapped(expression);
		if (visiting.has(node)) {
			return undefined;
		}
		visiting.add(node);
		const result = reference(node);
		visiting.delete(node);
		return result;
	}
	function reference(node: ts.Expression): readonly string[] | undefined {
		if (ts.isStringLiteralLike(node)) {
			return [node.text];
		}
		if (ts.isIdentifier(node)) {
			const symbol = checker.getSymbolAtLocation(node);
			return (
				symbol?.declarations?.map(declaration).find((item) => item !== undefined)
				?? (symbol === undefined && node.text === "process" ? ["process"] : undefined)
			);
		}
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			return access(node);
		}
		return undefined;
	}
	function access(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): readonly string[] | undefined {
		const base = value(node.expression);
		const name = memberName(node) ?? (ts.isElementAccessExpression(node) ? value(node.argumentExpression)?.[0] : undefined);
		return base !== undefined && name !== undefined ? [...base, name] : undefined;
	}
	function environment(path: readonly string[] | undefined): boolean {
		return path?.length === 2 && (path[0] === "process" || path[0] === "node:process") && path[1] === "env";
	}
	function databaseName(path: readonly string[] | undefined): boolean {
		return path?.length === 1 && path[0]?.endsWith("DATABASE_URL") === true;
	}
	function environmentBinding(node: ts.BindingElement): boolean {
		if (node.dotDotDotToken !== undefined || !ts.isObjectBindingPattern(node.parent)) {
			return false;
		}
		const parent = node.parent.parent;
		return (
			ts.isVariableDeclaration(parent)
			&& parent.initializer !== undefined
			&& environment(value(parent.initializer))
			&& bindingName(node)?.endsWith("DATABASE_URL") === true
		);
	}
	function read(node: ts.Node): boolean {
		if (ts.isCallExpression(node)) {
			const path = value(node.expression);
			const method = path?.at(-1) ?? "";
			const argument = node.arguments[method === "schema" ? 1 : 0];
			return (
				path !== undefined
				&& (READERS.has(method) || method === "schema")
				&& path.slice(0, -1).join("/") === "effect/Config"
				&& argument !== undefined
				&& databaseName(value(argument))
			);
		}
		if (ts.isBindingElement(node)) {
			return environmentBinding(node);
		}
		if (!(ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) {
			return false;
		}
		const path = value(node);
		return environment(path?.slice(0, -1)) && databaseName(path?.slice(-1)) && !write(node);
	}
	return nodesWhere(source, read);
}

function write(node: ts.Expression): boolean {
	const parent = node.parent;
	return (
		ts.isDeleteExpression(parent)
		|| (ts.isBinaryExpression(parent) && parent.left === node && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken)
	);
}
