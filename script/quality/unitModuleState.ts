import { Effect } from "effect";
import ts from "typescript";
import type { ImportEdge } from "@shivaedev/quality/imports/graph.ts";
import { importGraph } from "@shivaedev/quality/imports/graph.ts";
import { ENVIRONMENTS, testName } from "@shivaedev/quality/naming/testName.ts";
import type { Finding } from "@shivaedev/quality/rule.ts";
import { defineRule } from "@shivaedev/quality/rule.ts";
import { parse } from "@shivaedev/quality/rules/parse.ts";
import { importedChanges, mutatedBindings } from "#quality/mutatedBindings.ts";

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

function moduleState(path: string, tree: ts.SourceFile, changed: ReadonlySet<string>): readonly Finding[] {
	return tree.statements.flatMap((statement) => {
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		const constant = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
		return statement.declarationList.declarations.flatMap((declaration) => {
			const names = bound(declaration.name);
			const changing = constant ? names.filter((name) => container(declaration.initializer) && changed.has(name)) : names;
			return changing.map((name) => ({
				file: path,
				line: tree.getLineAndCharacterOfPosition(declaration.getStart(tree)).line + 1,
				message: `holds module-level state \`${name}\` that the files of @shivaedev/quality:unit share, because that project runs without per-file isolation. Keep the state in the story's engine or scope, or key a cache by the run's own objects in a WeakMap.`,
			}));
		});
	});
}

interface LoadedModule {
	readonly changed: ReadonlySet<string>;
	readonly path: string;
	readonly tree: ts.SourceFile;
}

function changedByAnyone(modules: readonly LoadedModule[], edges: readonly ImportEdge[]): ReadonlyMap<string, ReadonlySet<string>> {
	const targets = new Map(edges.flatMap((edge) => (edge.to.kind === "file" ? [[`${edge.from}:${edge.specifier}`, edge.to.path] as const] : [])));
	const changed = new Map(modules.map(({ changed: own, path }) => [path, new Set(own)]));
	for (const { changed: own, path, tree } of modules) {
		for (const { name, specifier } of importedChanges(tree, own)) {
			changed.get(targets.get(`${path}:${specifier}`) ?? "")?.add(name);
		}
	}
	return changed;
}

export const unitModuleState = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const graph = yield* importGraph(inputs);
			const starts = graph.modules.filter(unitFile);
			const shared = loaded(starts, graph.edges);
			const trees = inputs.sources.flatMap((file): LoadedModule[] => {
				const tree = shared.has(file.path) ? parse(file) : undefined;
				return tree === undefined ? [] : [{ changed: mutatedBindings(tree), path: file.path, tree }];
			});
			const changed = changedByAnyone(trees, graph.edges);
			return trees.flatMap(({ path, tree }) => (testName(path) === undefined ? moduleState(path, tree, changed.get(path) ?? new Set()) : []));
		}),
	description: "Modules that Quality's unit test files load hold no module-level state, because those files share one module graph per worker.",
	id: "tests/unit-module-state",
});
