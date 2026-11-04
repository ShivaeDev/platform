import ts from "typescript";
import { importFrom } from "#rules/stories/importOrigin.ts";
import { memberName } from "#rules/stories/syntax.ts";
import { type BodyReference, dataFactory, serviceFactory } from "./bodyReference.ts";

export function storyBody(body: ts.Expression, checker: ts.TypeChecker) {
	const declaration = checker.getTypeAtLocation(body).getCallSignatures()[0]?.declaration;
	return declaration !== undefined && "body" in declaration ? declaration : undefined;
}

function importName(node: ts.ImportSpecifier | ts.NamespaceImport | ts.ImportClause): string | undefined {
	if (ts.isImportSpecifier(node)) {
		return (node.propertyName ?? node.name).text;
	}
	return ts.isImportClause(node) ? "default" : undefined;
}

function wrapped(node: ts.Node): node is ts.ParenthesizedExpression | ts.AsExpression | ts.SatisfiesExpression | ts.NonNullExpression {
	return ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node);
}

function importBinding(node: ts.Node): node is ts.ImportSpecifier | ts.NamespaceImport | ts.ImportClause {
	return ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportClause(node);
}

export function bodyReferences(body: ts.SignatureDeclaration, checker: ts.TypeChecker) {
	const known = new Map<ts.Node, BodyReference | undefined>();
	const visiting = new Set<ts.Node>();
	const told = body.parameters[0];
	function symbol(value: ts.Symbol | undefined): BodyReference | undefined {
		const direct = value?.declarations?.map(visit).find((reference) => reference !== undefined);
		return direct ?? (value !== undefined && value.flags & ts.SymbolFlags.Alias ? symbol(checker.getAliasedSymbol(value)) : undefined);
	}
	function imported(node: ts.ImportSpecifier | ts.NamespaceImport | ts.ImportClause): BodyReference | undefined {
		const name = importName(node);
		const module = importFrom(node);
		if (module === undefined) {
			return undefined;
		}
		const value = checker.getSymbolAtLocation(node.name ?? node);
		const target = value !== undefined && value.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(value) : undefined;
		const resolved = symbol(target);
		if (resolved?.kind === "service" || resolved?.kind === "data") {
			return resolved;
		}
		const canonical = target?.declarations === undefined ? name : target.name;
		return { file: target?.declarations?.[0]?.getSourceFile().fileName, kind: "import", module, path: name === undefined ? [] : [canonical ?? name] };
	}

	function member(reference: BodyReference | undefined, name: string): BodyReference | undefined {
		return reference === undefined ? undefined : { ...reference, path: [...reference.path, name] };
	}
	function binding(node: ts.BindingElement): BodyReference | undefined {
		const name = node.propertyName ?? node.name;
		return ts.isIdentifier(name) || ts.isStringLiteral(name) ? member(visit(node.parent.parent), name.text) : undefined;
	}
	function call(node: ts.CallExpression): BodyReference | undefined {
		const called = visit(node.expression);
		if ((called?.kind === "service" && called.path.length === 0) || (called?.kind === "import" && serviceFactory(called))) {
			return { kind: "service", module: called.module, path: [] };
		}
		if (called?.kind === "data" || (called?.kind === "import" && dataFactory(called))) {
			return { kind: "data", module: called.module, path: [] };
		}
		return undefined;
	}
	function property(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): BodyReference | undefined {
		const receiver = visit(node.expression);
		if (receiver?.kind === "import" && receiver.path.length === 0) {
			const resolved = symbol(checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node) ? node.name : node));
			if (resolved?.kind === "service" || resolved?.kind === "data") {
				return resolved;
			}
		}
		return member(receiver, memberName(node) ?? "");
	}
	function variable(node: ts.VariableDeclaration): BodyReference | undefined {
		const value = node.initializer ?? node.type;
		return value === undefined ? undefined : visit(value);
	}
	function expression(node: ts.Node): BodyReference | undefined {
		if (ts.isTypeReferenceNode(node)) {
			const target = visit(node.typeName);
			return target?.kind === "import" && dataFactory(target) ? { kind: "data", module: target.module, path: [] } : undefined;
		}
		if (ts.isQualifiedName(node)) {
			return member(visit(node.left), node.right.text);
		}
		if (ts.isIdentifier(node)) {
			return symbol(checker.getSymbolAtLocation(node));
		}
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			return property(node);
		}
		return ts.isCallExpression(node) ? call(node) : undefined;
	}
	function classReference(node: ts.ClassDeclaration): BodyReference | undefined {
		return node.heritageClauses
			?.flatMap((clause) => clause.types.map((base) => visit(base.expression)))
			.find((value) => value?.kind === "service" || value?.kind === "data");
	}
	function origin(node: ts.Node): BodyReference | undefined {
		if (wrapped(node)) {
			return visit(node.expression);
		}
		if (node === told) {
			return { kind: "told", module: "", path: [] };
		}
		if (importBinding(node)) {
			return imported(node);
		}
		if (ts.isVariableDeclaration(node)) {
			return variable(node);
		}
		if (ts.isBindingElement(node)) {
			return binding(node);
		}
		if (ts.isClassDeclaration(node)) {
			return classReference(node);
		}
		return expression(node);
	}
	function visit(node: ts.Node): BodyReference | undefined {
		if (visiting.has(node) || known.has(node)) {
			return known.get(node);
		}
		visiting.add(node);
		const value = origin(node);
		visiting.delete(node);
		known.set(node, value);
		return value;
	}
	return visit;
}
