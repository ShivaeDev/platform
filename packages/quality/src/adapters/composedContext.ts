import ts from "typescript";
import { effectApi, resolvedValue } from "#adapters/serviceModelSyntax.ts";
import { boundaryReference } from "#rules/effect/boundaryReference.ts";

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

export function composedContext(checker: ts.TypeChecker, environment: ts.Expression): boolean {
	const value = resolvedValue(checker, environment);
	if (!(ts.isYieldExpression(value) && value.expression !== undefined && ts.isCallExpression(value.expression))) {
		return false;
	}
	const acquisition = value.expression;
	const reference = boundaryReference(checker, acquisition.expression);
	if (
		reference === "effect.Layer.build"
		|| reference === "effect/Layer.build"
		|| reference === "effect.Layer.buildWithScope"
		|| reference === "effect/Layer.buildWithScope"
	) {
		return true;
	}
	if (!effectApi(checker, acquisition.expression, "context")) {
		return false;
	}
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
