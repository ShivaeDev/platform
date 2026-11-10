import ts from "typescript";
import { foreignCallbackParameter, foreignDeclaration } from "#adapters/foreignCallback.ts";
import { parameterOrigins } from "#adapters/parameterOrigins.ts";
import { serviceProperty } from "#adapters/serviceAssemblySyntax.ts";
import { effectApi, resolvedValue } from "#adapters/serviceModelSyntax.ts";
import { returnValues } from "#rules/stories/returnValues.ts";

function constructed(checker: ts.TypeChecker, node: ts.Node, seen = new Set<ts.Node>()): boolean {
	if (seen.has(node)) {
		return false;
	}
	seen.add(node);
	if (ts.isExpression(node)) {
		const value = resolvedValue(checker, node);
		if (value !== node) {
			return constructed(checker, value, seen);
		}
	}
	if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
		return acquisition(checker, node, seen);
	}
	if (ts.isYieldExpression(node)) {
		return node.expression === undefined ? false : constructed(checker, node.expression, seen);
	}
	return ts.isFunctionLike(node) && returnValues(node).some((value) => value !== undefined && constructed(checker, value, seen));
}

function acquisition(checker: ts.TypeChecker, node: ts.CallExpression | ts.NewExpression, seen: Set<ts.Node>): boolean {
	const signature = checker.getResolvedSignature(node);
	if (signature?.declaration !== undefined && foreignDeclaration(signature.declaration)) {
		return true;
	}
	if (ts.isCallExpression(node)) {
		const factory = resolvedValue(checker, node.expression);
		if (ts.isFunctionLike(factory) && constructed(checker, factory, seen)) {
			return true;
		}
	}
	if (!(ts.isCallExpression(node) && ["promise", "tryPromise", "sync", "acquireRelease"].some((name) => effectApi(checker, node.expression, name)))) {
		return false;
	}
	const value = node.arguments[0];
	const callback = value !== undefined && ts.isObjectLiteralExpression(value) ? serviceProperty(value, "try") : value;
	return callback !== undefined && constructed(checker, callback, seen);
}

export function foreignResources(checker: ts.TypeChecker, sources: readonly ts.SourceFile[]) {
	const originates = parameterOrigins(checker, sources);
	return (parameter: ts.ParameterDeclaration): boolean => {
		const type = checker.getTypeAtLocation(parameter);
		if (!(type.getSymbol()?.declarations ?? []).some(foreignDeclaration) || type.getProperty("~effect/Context/Service") !== undefined) {
			return false;
		}
		return originates(parameter, (value) => {
			const declaration = ts.isIdentifier(value) ? checker.getSymbolAtLocation(value)?.valueDeclaration : value;
			return (
				(declaration !== undefined && ts.isParameter(declaration) && foreignCallbackParameter(checker, declaration)) || constructed(checker, value)
			);
		});
	};
}
