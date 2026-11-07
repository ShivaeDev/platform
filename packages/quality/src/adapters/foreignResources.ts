import ts from "typescript";
import { serviceProperty } from "#adapters/serviceAssemblySyntax.ts";
import { effectApi, resolvedValue } from "#adapters/serviceModelSyntax.ts";
import { returnValues } from "#rules/stories/returnValues.ts";

function foreign(node: ts.Declaration): boolean {
	const file = node.getSourceFile().fileName.replaceAll("\\", "/");
	return file.includes("/node_modules/") && !/\/(?:effect|@effect|@shivaedev)\//u.test(file);
}

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
	if (signature?.declaration !== undefined && foreign(signature.declaration)) {
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
	let calls: Map<ts.ParameterDeclaration, ts.Expression[]> | undefined;
	function argumentsIn() {
		if (calls !== undefined) {
			return calls;
		}
		const arguments_ = new Map<ts.ParameterDeclaration, ts.Expression[]>();
		function visit(node: ts.Node): void {
			if (ts.isCallExpression(node)) {
				const declaration = checker.getResolvedSignature(node)?.declaration;
				for (const [index, parameter] of (declaration?.parameters ?? []).entries()) {
					const argument = node.arguments[index];
					if (argument !== undefined && ts.isParameter(parameter)) {
						const values = arguments_.get(parameter) ?? [];
						values.push(argument);
						arguments_.set(parameter, values);
					}
				}
			}
			ts.forEachChild(node, visit);
		}
		for (const source of sources) {
			visit(source);
		}
		calls = arguments_;
		return arguments_;
	}
	return (parameter: ts.ParameterDeclaration): boolean => {
		const source = parameter.getSourceFile();
		if (!/(?:^|\/)adapters\//u.test(source.fileName)) {
			return false;
		}
		const type = checker.getTypeAtLocation(parameter);
		if (!(type.getSymbol()?.declarations ?? []).some(foreign) || type.getProperty("~effect/Context/Service") !== undefined) {
			return false;
		}
		const values = argumentsIn().get(parameter) ?? [];
		return values.length > 0 && values.every((value) => constructed(checker, value));
	};
}
