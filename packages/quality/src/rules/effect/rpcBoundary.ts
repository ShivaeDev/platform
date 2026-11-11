import ts from "typescript";
import { isTestSupport } from "#naming/testName.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { type ImportBinding, importBindings } from "#rules/stories/importBindings.ts";
import { findingAt, memberName, nodesWhere, unwrapped } from "#rules/stories/syntax.ts";

const BOUNDARIES: ReadonlyMap<string, string> = new Map([
	["@shivaedev/errors/boundary.ts", "rpcBoundary"],
	["@shivaedev/errors/rpcBoundaryHandlers.ts", "rpcBoundaryHandlers"],
]);
const BUILDERS: ReadonlySet<string> = new Set(["toLayer", "toLayerHandler", "toHandlers", "of"]);
const EFFECT_MODULE = /^(?:effect|@effect\/[^/]+)(?:\/|$)/u;
const RPC_MODULE = /^(?:effect\/(?:unstable\/)?rpc|@effect\/rpc)(?:\/|$)/u;

function rootIdentifier(expression: ts.Expression): ts.Identifier | undefined {
	const value = unwrapped(expression);
	if (ts.isIdentifier(value)) {
		return value;
	}
	return ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) || ts.isCallExpression(value)
		? rootIdentifier(value.expression)
		: undefined;
}

function localValues(source: ts.SourceFile): ReadonlyMap<string, ts.Expression | undefined> {
	const values = new Map<string, ts.Expression | undefined>();
	for (const node of nodesWhere(source, (candidate) => ts.isVariableDeclaration(candidate) || ts.isClassLike(candidate))) {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
			values.set(node.name.text, node.initializer);
		} else if (ts.isClassLike(node) && node.name !== undefined) {
			values.set(node.name.text, node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression);
		}
	}
	return values;
}

type Origin = "effect" | "elsewhere" | "rpc" | "value";

interface Scope {
	readonly bindings: ReadonlyMap<string, ImportBinding>;
	readonly locals: ReadonlyMap<string, ts.Expression | undefined>;
}

function moduleOrigin(module: string): Origin {
	if (RPC_MODULE.test(module)) {
		return "rpc";
	}
	return EFFECT_MODULE.test(module) ? "effect" : "elsewhere";
}

function origin(root: ts.Identifier | undefined, scope: Scope, hops: number): Origin {
	const binding = root === undefined ? undefined : scope.bindings.get(root.text);
	if (binding !== undefined) {
		return moduleOrigin(binding.module);
	}
	if (root !== undefined && !scope.locals.has(root.text)) {
		return "elsewhere";
	}
	const value = root === undefined ? undefined : scope.locals.get(root.text);
	return value === undefined || hops > 8 ? "value" : origin(rootIdentifier(value), scope, hops + 1);
}

// A group often arrives as an import or a parameter, so any such receiver builds handlers, except that a service tag's of shares the name and only a visible group or a member chain such as a contract's application counts for it.
function buildsHandlers(source: ts.SourceFile, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	const scope: Scope = { bindings, locals: localValues(source) };
	return nodesWhere(source, ts.isCallExpression).some((call) => {
		const callee = ts.isCallExpression(call) ? unwrapped(call.expression) : undefined;
		if (callee === undefined || !ts.isPropertyAccessExpression(callee) || !BUILDERS.has(callee.name.text)) {
			return false;
		}
		const from = origin(rootIdentifier(callee.expression), scope, 0);
		const chained = !ts.isIdentifier(unwrapped(callee.expression));
		return from === "rpc" || (from === "elsewhere" && (callee.name.text !== "of" || chained));
	});
}

function boundaryCalled(call: ts.CallExpression, bindings: ReadonlyMap<string, ImportBinding>): string | undefined {
	const callee = unwrapped(call.expression);
	if (ts.isIdentifier(callee)) {
		const binding = bindings.get(callee.text);
		return binding !== undefined && BOUNDARIES.get(binding.module) === binding.imported ? binding.imported : undefined;
	}
	const namespace = ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) ? bindings.get(callee.expression.text) : undefined;
	return namespace?.imported === "*" && BOUNDARIES.get(namespace.module) === memberName(callee) ? memberName(callee) : undefined;
}

function findings(file: SourceFile): readonly Finding[] {
	const source = isTestSupport(file.path) || !file.text.includes("rpcBoundary") ? undefined : parse(file);
	if (source === undefined) {
		return [];
	}
	const bindings = importBindings(source);
	if (![...bindings.values()].some((binding) => BOUNDARIES.has(binding.module)) || buildsHandlers(source, bindings)) {
		return [];
	}
	return nodesWhere(source, ts.isCallExpression).flatMap((call) => {
		const name = ts.isCallExpression(call) ? boundaryCalled(call, bindings) : undefined;
		return name === undefined
			? []
			: [
					findingAt(
						source,
						call,
						`Uses ${name} outside a module that builds RPC handlers. Move the boundary into the module calling the RPC group's toLayer, toLayerHandler, toHandlers or of; services must keep their own typed failures.`,
					),
				];
	});
}

export const rpcBoundary = defineRule({
	check: ({ sources }) => sources.flatMap(findings),
	description:
		"Apply rpcBoundary and rpcBoundaryHandlers, imported from @shivaedev/errors, only in modules building native RPC handlers; services keep their typed failures. Test-support kits are accepted. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/rpc-boundary",
	registrable: false,
});
