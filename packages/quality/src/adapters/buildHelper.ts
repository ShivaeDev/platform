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

function localHelper(expression: ts.Expression, call: ts.CallExpression): Helper | undefined {
	if (!ts.isIdentifier(expression)) {
		return undefined;
	}
	for (let scope: ts.Node | undefined = call.parent; scope !== undefined; scope = scope.parent) {
		const helper = ts.isSourceFile(scope) || ts.isBlock(scope) ? declared(scope, expression.text) : undefined;
		if (helper !== undefined) {
			return helper;
		}
	}
	return undefined;
}

export function importedSource(node: ts.Node, module: string, sources: ReadonlyMap<string, ts.SourceFile>): ts.SourceFile | undefined {
	if (!(module.startsWith(".") || module.startsWith("#"))) {
		return undefined;
	}
	const modulePath = module.startsWith("#") ? module.slice(1) : posix.join(posix.dirname(node.getSourceFile().fileName), module);
	return sources.get(modulePath) ?? [...sources.values()].find((candidate) => candidate.fileName.replaceAll("\\", "/").endsWith(`/${modulePath}`));
}

function importedHelper(call: ts.CallExpression, sources: ReadonlyMap<string, ts.SourceFile>): Helper | undefined {
	const imported = importedCall(call);
	const source = imported === undefined ? undefined : importedSource(call, imported.module, sources);
	return source === undefined || imported === undefined ? undefined : declared(source, imported.name);
}

export function buildHelper(call: ts.CallExpression, sources: ReadonlyMap<string, ts.SourceFile>, bindings: BuildBindings): Helper | undefined {
	const expression = buildEntryValue(call.expression, new Set(), bindings);
	if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
		return expression;
	}
	return localHelper(expression, call) ?? importedHelper(call, sources);
}
