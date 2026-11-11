import { Effect } from "effect";
import ts from "typescript";
import type { ImportEdge } from "@shivaedev/quality/imports/graph.ts";
import { importGraph } from "@shivaedev/quality/imports/graph.ts";
import { ENVIRONMENTS, testName } from "@shivaedev/quality/naming/testName.ts";
import type { Finding, SourceFile } from "@shivaedev/quality/rule.ts";
import { defineRule } from "@shivaedev/quality/rule.ts";
import { parse } from "@shivaedev/quality/rules/parse.ts";
import { mutatedBindings } from "#quality/mutatedBindings.ts";

const UNIT_PROJECT = "packages/quality/src/";

const ENVIRONMENT_NAMES: ReadonlySet<string> = new Set(ENVIRONMENTS);

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
	return (
		initializer !== undefined
		&& (ts.isArrayLiteralExpression(initializer)
			|| ts.isObjectLiteralExpression(initializer)
			|| (ts.isNewExpression(initializer) && CONTAINERS.has(initializer.expression.getText())))
	);
}

function bound(name: ts.BindingName): readonly string[] {
	return ts.isIdentifier(name) ? [name.text] : name.elements.flatMap((element) => (ts.isOmittedExpression(element) ? [] : bound(element.name)));
}

function moduleState(file: SourceFile): readonly Finding[] {
	const tree = parse(file);
	if (tree === undefined) {
		return [];
	}
	const changed = mutatedBindings(tree);
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
