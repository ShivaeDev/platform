import ts from "typescript";
import { containerDependency } from "#adapters/containerDependency.ts";
import { serviceProperty } from "#adapters/serviceAssemblySyntax.ts";
import { effectApi, effectSuccess, resolvedValue } from "#adapters/serviceModelSyntax.ts";
import { boundaryReference } from "#rules/effect/boundaryReference.ts";
import type { serviceTypes } from "#rules/effect/serviceTypes.ts";
import { returnValues } from "#rules/stories/returnValues.ts";

function capturesDependency(
	checker: ts.TypeChecker,
	value: ts.Node,
	services: ReturnType<typeof serviceTypes>,
	seen = new Set<ts.Node>(),
	closing = false,
): boolean {
	if (seen.has(value) || ts.isTypeNode(value)) {
		return false;
	}
	seen.add(value);
	if (ts.isYieldExpression(value) && value.expression !== undefined && services.carries(checker.getTypeAtLocation(value.expression))) {
		return !["effect.Scope.Scope", "effect/Scope.Scope"].includes(boundaryReference(checker, value.expression) ?? "");
	}
	if (
		!closing
		&& ts.isExpression(value)
		&& checker.getTypeAtLocation(value).flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike)
	) {
		return false;
	}
	if (ts.isCallExpression(value)) {
		return callDependency(checker, value, services, seen, closing);
	}
	if (ts.isIdentifier(value)) {
		return identifierDependency(checker, value, services, seen, closing);
	}
	return (
		ts.forEachChild(value, (child) => capturesDependency(checker, child, services, seen, closing || ts.isFunctionLike(value)) || undefined) ?? false
	);
}

function identifierDependency(
	checker: ts.TypeChecker,
	value: ts.Identifier,
	services: ReturnType<typeof serviceTypes>,
	seen: Set<ts.Node>,
	closing: boolean,
): boolean {
	const symbol = checker.getSymbolAtLocation(value);
	const target = symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
	if (target !== undefined && target.flags & ts.SymbolFlags.ValueModule) {
		return false;
	}
	const resolved = resolvedValue(checker, value);
	return resolved === value ? services.carries(checker.getTypeAtLocation(value)) : capturesDependency(checker, resolved, services, seen, closing);
}

function callDependency(
	checker: ts.TypeChecker,
	value: ts.CallExpression,
	services: ReturnType<typeof serviceTypes>,
	seen: Set<ts.Node>,
	closing: boolean,
): boolean {
	const owner = ts.isPropertyAccessExpression(value.expression) ? value.expression.expression : undefined;
	return (
		(owner !== undefined && services.implementation(checker.getTypeAtLocation(owner)) && capturesDependency(checker, owner, services, seen, closing))
		|| value.arguments.some((argument) => capturesDependency(checker, argument, services, seen, closing))
	);
}

export function serviceStateProblems(
	checker: ts.TypeChecker,
	config: ts.ObjectLiteralExpression,
	services: ReturnType<typeof serviceTypes>,
): readonly { node: ts.Node; message: string }[] {
	const initialize = serviceProperty(config, "initialize");
	if (initialize === undefined) {
		return [];
	}
	const type = checker.getTypeAtLocation(initialize);
	const state = effectSuccess(checker, type);
	let dependency = services.carries(type) || (state !== undefined && (services.carries(state) || containerDependency(checker, state, services)));
	const initializer = resolvedValue(checker, initialize);
	// A function in state can hide a service even when its public type does not carry it.
	function inspect(node: ts.Node): void {
		if (ts.isCallExpression(node) && ["succeed", "as"].some((name) => effectApi(checker, node.expression, name))) {
			const retained = node.arguments.at(-1);
			dependency ||= retained !== undefined && capturesDependency(checker, retained, services);
		}
		if (ts.isFunctionLike(node)) {
			for (const value of returnValues(node)) {
				if (value !== undefined && capturesDependency(checker, value, services)) {
					dependency = true;
				}
			}
			return;
		}
		ts.forEachChild(node, inspect);
	}
	if (!dependency) {
		inspect(initializer);
	}
	return dependency
		? [
				{
					message:
						"Initializer state carries a dependency. Declare it in requires and yield it in each operation. Keep only owned caches, refs, locks and captured context data in initialize; choose their lifetime where the Layer is registered.",
					node: initialize,
				},
			]
		: [];
}
