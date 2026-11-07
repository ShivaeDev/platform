import ts from "typescript";
import { effectApi, resolvedValue } from "#adapters/serviceModelSyntax.ts";
import { boundaryReference } from "#rules/effect/boundaryReference.ts";

const COMPOSERS = new Set(["effect.Context.merge", "effect/Context.merge", "effect.Scope.provide", "effect/Scope.provide"]);

function compositionInputs(checker: ts.TypeChecker, call: ts.CallExpression): readonly ts.Expression[] | undefined {
	if (COMPOSERS.has(boundaryReference(checker, call.expression) ?? "")) {
		return call.arguments;
	}
	if (ts.isCallExpression(call.expression) && COMPOSERS.has(boundaryReference(checker, call.expression.expression) ?? "")) {
		return [...call.expression.arguments, ...call.arguments];
	}
	if (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "pipe") {
		const composers = call.arguments.filter(
			(argument) => ts.isCallExpression(argument) && COMPOSERS.has(boundaryReference(checker, argument.expression) ?? ""),
		);
		if (composers.length > 0) {
			return [call.expression.expression, ...composers.flatMap((composer) => (ts.isCallExpression(composer) ? [...composer.arguments] : []))];
		}
	}
	return undefined;
}

function closedEffect(checker: ts.TypeChecker, node: ts.Node): boolean {
	const brand = checker.getTypeAtLocation(node).getProperty("~effect/Effect");
	const requirement = brand === undefined ? undefined : checker.getTypeOfSymbol(brand).getProperty("_R");
	const type = requirement === undefined ? undefined : checker.getTypeOfSymbol(requirement).getCallSignatures()[0]?.getReturnType();
	return type !== undefined && (type.flags & ts.TypeFlags.Never) !== 0;
}

function layerProvision(checker: ts.TypeChecker, node: ts.Node): boolean {
	return (
		ts.isCallExpression(node)
		&& effectApi(checker, node.expression, "provide")
		&& node.arguments.some((argument) => checker.getTypeAtLocation(argument).getProperty("~effect/Layer") !== undefined)
	);
}

function fullyProvided(checker: ts.TypeChecker, value: ts.Node): boolean {
	let provided = false;
	for (let ancestor: ts.Node | undefined = value.parent; ancestor !== undefined; ancestor = ancestor.parent) {
		if (ts.isCallExpression(ancestor)) {
			provided ||= layerProvision(checker, ancestor) || ancestor.arguments.some((argument) => layerProvision(checker, argument));
			if (provided && closedEffect(checker, ancestor)) {
				return true;
			}
		}
	}
	return false;
}

export function composedContext(checker: ts.TypeChecker, environment: ts.Expression, seen = new Set<ts.Node>()): boolean {
	const value = resolvedValue(checker, environment);
	if (seen.has(value)) {
		return false;
	}
	seen.add(value);
	const acquisition = ts.isYieldExpression(value) ? value.expression : value;
	if (acquisition === undefined || !ts.isCallExpression(acquisition)) {
		return false;
	}
	const reference = boundaryReference(checker, acquisition.expression);
	const inputs = compositionInputs(checker, acquisition);
	if (inputs !== undefined) {
		return inputs.some((argument) => composedContext(checker, argument, seen));
	}
	if (["effect.Layer.build", "effect/Layer.build", "effect.Layer.buildWithScope", "effect/Layer.buildWithScope"].includes(reference ?? "")) {
		return true;
	}
	return effectApi(checker, acquisition.expression, "context") && fullyProvided(checker, value);
}
