import { Effect } from "effect";
import ts from "typescript";
import type { ImportEdge } from "@shivaedev/quality/imports/graph.ts";
import { importGraph } from "@shivaedev/quality/imports/graph.ts";
import { ENVIRONMENTS, testName } from "@shivaedev/quality/naming/testName.ts";
import type { Finding, SourceFile } from "@shivaedev/quality/rule.ts";
import { defineRule } from "@shivaedev/quality/rule.ts";
import { parse } from "@shivaedev/quality/rules/parse.ts";

const UNIT_PROJECT = "packages/quality/src/";

const ENVIRONMENT_NAMES: ReadonlySet<string> = new Set(ENVIRONMENTS);

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

const CONTAINERS: ReadonlySet<string> = new Set(["Array", "Map", "Set"]);

function unitFile(path: string): boolean {
	const name = testName(path);
	return (
		path.startsWith(UNIT_PROJECT)
		&& name !== undefined
		&& name.stem !== "typecheck"
		&& !name.modifiers.some((modifier) => ENVIRONMENT_NAMES.has(modifier))
	);
}

// Type-only imports and resolved paths evaluate nothing, so only value imports load a module into the shared worker.
function loaded(starts: readonly string[], edges: readonly ImportEdge[]): ReadonlySet<string> {
	const from = new Map<string, string[]>();
	for (const edge of edges) {
		if (edge.to.kind === "file" && edge.kind === "import" && !edge.type) {
			from.set(edge.from, [...(from.get(edge.from) ?? []), edge.to.path]);
		}
	}
	const seen = new Set(starts);
	for (const path of seen) {
		for (const next of from.get(path) ?? []) {
			seen.add(next);
		}
	}
	return seen;
}

function container(initializer: ts.Expression | undefined): boolean {
	if (initializer === undefined) {
		return false;
	}
	if (ts.isArrayLiteralExpression(initializer) || ts.isObjectLiteralExpression(initializer)) {
		return true;
	}
	return ts.isNewExpression(initializer) && ts.isIdentifier(initializer.expression) && CONTAINERS.has(initializer.expression.text);
}

function receiver(expression: ts.Expression): string | undefined {
	if (ts.isIdentifier(expression)) {
		return expression.text;
	}
	return ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression) ? receiver(expression.expression) : undefined;
}

function changedThrough(node: ts.Node): ts.Expression | undefined {
	if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && MUTATORS.has(node.expression.name.text)) {
		return node.expression.expression;
	}
	if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.getText() === "Object.assign") {
		return node.arguments[0];
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

function mutated(tree: ts.SourceFile): ReadonlySet<string> {
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

function bound(name: ts.BindingName): readonly string[] {
	return ts.isIdentifier(name) ? [name.text] : name.elements.flatMap((element) => (ts.isOmittedExpression(element) ? [] : bound(element.name)));
}

function moduleState(file: SourceFile): readonly Finding[] {
	const tree = parse(file);
	if (tree === undefined) {
		return [];
	}
	const changed = mutated(tree);
	return tree.statements.flatMap((statement) => {
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		const constant = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
		return statement.declarationList.declarations.flatMap((declaration) => {
			const names = bound(declaration.name);
			const changing = constant ? names.filter((name) => container(declaration.initializer) && changed.has(name)) : names;
			return changing.map((name) => ({
				file: file.path,
				line: tree.getLineAndCharacterOfPosition(declaration.getStart(tree)).line + 1,
				message: `holds module-level state \`${name}\` that the files of @shivaedev/quality:unit share, because that project runs without per-file isolation. Keep the state in the story's engine or scope, or key a cache by the run's own objects in a WeakMap.`,
			}));
		});
	});
}

export const unitModuleState = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const graph = yield* importGraph(inputs);
			const starts = graph.modules.filter(unitFile);
			const shared = loaded(starts, graph.edges);
			return inputs.sources.filter((file) => shared.has(file.path) && testName(file.path) === undefined).flatMap(moduleState);
		}),
	description: "Modules that Quality's unit test files load hold no module-level state, because those files share one module graph per worker.",
	id: "tests/unit-module-state",
});
