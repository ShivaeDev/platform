import { posix } from "node:path";
import ts from "typescript";
import { type BuildBindings, buildEntryValue } from "#adapters/buildEntryValue.ts";
import { importedCall } from "#adapters/importedCall.ts";

type Helper = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;

export function buildArguments(helper: Helper, call: ts.CallExpression, bindings: BuildBindings): BuildBindings {
	const arguments_ = new Map(bindings);
	for (const [index, parameter] of helper.parameters.entries()) {
		const value = call.arguments[index] ?? parameter.initializer;
		if (value !== undefined) {
			arguments_.set(parameter, buildEntryValue(value, new Set(), bindings));
		}
	}
	return arguments_;
}

function declared(scope: ts.SourceFile | ts.Block, name: string): Helper | undefined {
	for (const statement of scope.statements) {
		if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
			return statement;
		}
		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				const value = declaration.initializer;
				if (
					ts.isIdentifier(declaration.name)
					&& declaration.name.text === name
					&& value !== undefined
					&& (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
				) {
					return value;
				}
			}
		}
	}
	return undefined;
}

export function buildHelper(call: ts.CallExpression, sources: ReadonlyMap<string, ts.SourceFile>, bindings: BuildBindings): Helper | undefined {
	const expression = buildEntryValue(call.expression, new Set(), bindings);
	if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
		return expression;
	}
	if (ts.isIdentifier(expression)) {
		for (let scope: ts.Node | undefined = call.parent; scope !== undefined; scope = scope.parent) {
			const helper = ts.isSourceFile(scope) || ts.isBlock(scope) ? declared(scope, expression.text) : undefined;
			if (helper !== undefined) {
				return helper;
			}
		}
	}
	const imported = importedCall(call);
	if (imported === undefined || !imported.module.startsWith(".")) {
		return undefined;
	}
	const path = posix.join(posix.dirname(call.getSourceFile().fileName), imported.module);
	const source = sources.get(path);
	return source === undefined ? undefined : declared(source, imported.name);
}
