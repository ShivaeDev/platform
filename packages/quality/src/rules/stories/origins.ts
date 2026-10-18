import { join } from "node:path";
import ts from "typescript";
import type { ImportGraph } from "#imports/graph.ts";
import type { RuleInputs } from "#rule.ts";
import { storyProgram } from "./program.ts";

type Origin = "factory" | "kit" | "story" | "plain" | "suite" | "vitest" | "stories" | "function" | undefined;

function importFrom(node: ts.Node): string | undefined {
	for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
		if (ts.isImportDeclaration(current) && ts.isStringLiteral(current.moduleSpecifier)) {
			return current.moduleSpecifier.text;
		}
	}
	return undefined;
}

function moduleOrigin(from: string | undefined): Origin {
	if (from === "vitest" || from === "@effect/vitest") {
		return "vitest";
	}
	return from === "@shivaedev/test-story" || from === "@shivaedev/test-story/storyKit.ts" ? "stories" : undefined;
}

function imported(name: string, from: string | undefined): Origin {
	const namespace = moduleOrigin(from);
	if (name === "storyKit" && namespace === "stories") {
		return "factory";
	}
	if ((name === "describe" || name === "suite") && namespace === "vitest") {
		return "suite";
	}
	return (name === "it" || name === "test") && namespace === "vitest" ? "plain" : undefined;
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
		const name = node.propertyName ?? node.name;
		return value !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? member(value, name.text) : undefined;
	}

	function declaration(node: ts.Node): Origin {
		if (ts.isImportSpecifier(node)) {
			return imported((node.propertyName ?? node.name).text, importFrom(node));
		}
		if (ts.isNamespaceImport(node)) {
			return moduleOrigin(importFrom(node));
		}
		if (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) {
			return node.initializer === undefined ? undefined : origin(node.initializer);
		}
		return localBinding(node);
	}

	function localBinding(node: ts.Node): Origin {
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

	function member(value: ts.Expression, name: string): Origin {
		const receiver = visit(value);
		if (receiver === "kit" && name === "it") {
			return "story";
		}
		if (receiver === "story" || receiver === "plain" || receiver === "suite") {
			return receiver;
		}
		const from = receiver === "vitest" ? "vitest" : undefined;
		return imported(name, receiver === "stories" ? "@shivaedev/test-story/storyKit.ts" : from);
	}

	function identifier(node: ts.Identifier): Origin {
		if (node.text === "describe" || node.text === "suite") {
			return symbol(checker.getSymbolAtLocation(node)) ?? "suite";
		}
		const value = checker.getSymbolAtLocation(node);
		return symbol(value) ?? (value === undefined && (node.text === "it" || node.text === "test") ? "plain" : undefined);
	}

	function origin(node: ts.Node): Origin {
		if (ts.isFunctionLike(node)) {
			return "function";
		}
		if (ts.isObjectLiteralExpression(node)) {
			return object(node);
		}
		return expression(node);
	}

	function expression(node: ts.Node): Origin {
		if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
			return visit(node.expression);
		}
		if (ts.isCallExpression(node)) {
			const callee = visit(node.expression);
			return callee === "factory" ? "kit" : callee;
		}
		if (ts.isPropertyAccessExpression(node)) {
			return member(node.expression, node.name.text) ?? symbol(checker.getSymbolAtLocation(node.name));
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
