import ts from "typescript";
import { initializerDependency } from "#adapters/initializerDependency.ts";
import { serviceProperty } from "#adapters/serviceAssemblySyntax.ts";
import { effectSuccess, resolvedValue } from "#adapters/serviceModelSyntax.ts";
import type { serviceTypes } from "#rules/effect/serviceTypes.ts";
import { returnValues } from "#rules/stories/returnValues.ts";

function capturesDependency(
	checker: ts.TypeChecker,
	value: ts.Node,
	services: ReturnType<typeof serviceTypes>,
	seen = new Set<ts.Node>(),
	closing = false,
): boolean {
	if (seen.has(value)) {
		return false;
	}
	seen.add(value);
	if (ts.isYieldExpression(value) && value.expression !== undefined && services.carries(checker.getTypeAtLocation(value.expression))) {
		return true;
	}
	if (
		!closing
		&& ts.isExpression(value)
		&& checker.getTypeAtLocation(value).flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike)
	) {
		return false;
	}
	if (ts.isCallExpression(value)) {
		const owner = ts.isPropertyAccessExpression(value.expression) ? value.expression.expression : undefined;
		return (
			(owner !== undefined && services.implementation(checker.getTypeAtLocation(owner)))
			|| value.arguments.some((argument) => capturesDependency(checker, argument, services, seen, closing))
		);
	}
	if (ts.isIdentifier(value)) {
		if (services.carries(checker.getTypeAtLocation(value))) {
			return true;
		}
		const resolved = resolvedValue(checker, value);
		return resolved !== value && capturesDependency(checker, resolved, services, seen, closing);
	}
	return (
		ts.forEachChild(value, (child) => capturesDependency(checker, child, services, seen, closing || ts.isFunctionLike(value)) || undefined) ?? false
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
	const state = effectSuccess(checker, checker.getTypeAtLocation(initialize));
	let dependency =
		services.carries(checker.getTypeAtLocation(initialize))
		|| (state !== undefined && (services.carries(state) || initializerDependency(checker, state)));
	const initializer = resolvedValue(checker, initialize);
	// A function in state can hide a service even when its public type does not carry it.
	function inspect(node: ts.Node): void {
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
