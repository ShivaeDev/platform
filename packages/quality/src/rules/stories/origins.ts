import { join } from "node:path";
import ts from "typescript";
import type { ImportGraph } from "#imports/graph.ts";
import type { RuleInputs } from "#rule.ts";
import { storyProgram } from "./program.ts";

type Origin = "factory" | "kit" | "story" | "plain" | undefined;

function importFrom(node: ts.Node): string | undefined {
	for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
		if (ts.isImportDeclaration(current) && ts.isStringLiteral(current.moduleSpecifier)) {
			return current.moduleSpecifier.text;
		}
	}
	return undefined;
}

function imported(name: string, from: string | undefined): Origin {
	if (name === "storyKit" && (from === "@shivaedev/test-story" || from === "@shivaedev/test-story/storyKit.ts")) {
		return "factory";
	}
	return (name === "it" || name === "test") && (from === "vitest" || from === "@effect/vitest") ? "plain" : undefined;
}

export function storyOrigins(inputs: RuleInputs, graph: ImportGraph) {
	const program = storyProgram(inputs, graph);
	const checker = program.getTypeChecker();
	const visiting = new Set<ts.Node>();
	const known = new Map<ts.Node, Origin>();

	function binding(node: ts.BindingElement): Origin {
		if (!ts.isVariableDeclaration(node.parent.parent)) {
			return undefined;
		}
		const value = node.parent.parent.initializer;
		return value !== undefined && (node.propertyName ?? node.name).getText() === "it" && visit(value) === "kit" ? "story" : undefined;
	}

	function declaration(node: ts.Node): Origin {
		if (ts.isImportSpecifier(node)) {
			return imported((node.propertyName ?? node.name).text, importFrom(node));
		}
		if (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) {
			return node.initializer === undefined ? undefined : origin(node.initializer);
		}
		if (ts.isShorthandPropertyAssignment(node)) {
			return symbol(checker.getShorthandAssignmentValueSymbol(node));
		}
		return ts.isBindingElement(node) ? binding(node) : undefined;
	}

	function symbol(value: ts.Symbol | undefined): Origin {
		if (value === undefined) {
			return undefined;
		}
		const direct = value.declarations?.map(visit).find((result) => result !== undefined);
		return direct ?? (value.flags & ts.SymbolFlags.Alias ? symbol(checker.getAliasedSymbol(value)) : undefined);
	}

	function object(node: ts.ObjectLiteralExpression): Origin {
		for (const property of [...node.properties].reverse()) {
			if (property.name?.getText() === "it") {
				return visit(property) === "story" ? "kit" : undefined;
			}
			if (ts.isSpreadAssignment(property) && visit(property.expression) === "kit") {
				return "kit";
			}
		}
		return undefined;
	}

	function propertyOrigin(node: ts.PropertyAccessExpression): Origin {
		const receiver = visit(node.expression);
		if (receiver === "kit" && node.name.text === "it") {
			return "story";
		}
		if (receiver === "story" || receiver === "plain") {
			return receiver;
		}
		const namespace = checker.getSymbolAtLocation(node.expression)?.declarations?.find(ts.isNamespaceImport);
		const direct = imported(node.name.text, namespace === undefined ? undefined : importFrom(namespace));
		return direct ?? symbol(checker.getSymbolAtLocation(node.name));
	}

	function identifier(node: ts.Identifier): Origin {
		return symbol(checker.getSymbolAtLocation(node)) ?? (node.text === "it" || node.text === "test" ? "plain" : undefined);
	}

	function origin(node: ts.Node): Origin {
		if (ts.isObjectLiteralExpression(node)) {
			return object(node);
		}
		if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
			return visit(node.expression);
		}
		if (ts.isCallExpression(node)) {
			const callee = visit(node.expression);
			return callee === "factory" ? "kit" : callee;
		}
		if (ts.isPropertyAccessExpression(node)) {
			return propertyOrigin(node);
		}
		return ts.isIdentifier(node) ? identifier(node) : declaration(node);
	}

	function visit(node: ts.Node): Origin {
		if (visiting.has(node) || known.has(node)) {
			return known.get(node);
		}
		visiting.add(node);
		const result = origin(node);
		visiting.delete(node);
		known.set(node, result);
		return result;
	}

	return { origin: visit, source: (path: string) => program.getSourceFile(join(inputs.root, path)) };
}
