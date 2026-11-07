import ts from "typescript";
import { parameterOrigins } from "#adapters/parameterOrigins.ts";
import { serviceAssemblyImports } from "#adapters/serviceAssemblyImports.ts";
import { directServiceDefinitions, serviceProperty } from "#adapters/serviceAssemblySyntax.ts";
import { effectApi, resolvedValue } from "#adapters/serviceModelSyntax.ts";

function wrappedCallArguments(
	checker: ts.TypeChecker,
	parameter: ts.ParameterDeclaration,
	sources: readonly ts.SourceFile[],
): readonly ts.Expression[] | undefined {
	const callback = parameter.parent;
	if (
		!(
			(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
			&& ts.isCallExpression(callback.parent)
			&& callback.parent.arguments.includes(callback)
		)
	) {
		return undefined;
	}
	const wrapper = callback.parent;
	if (!(ts.isCallExpression(wrapper.expression) && effectApi(checker, wrapper.expression.expression, "fn"))) {
		return undefined;
	}
	const declaration = wrapper.parent;
	if (!(ts.isVariableDeclaration(declaration) && declaration.initializer === wrapper && ts.isIdentifier(declaration.name))) {
		return undefined;
	}
	const symbol = checker.getSymbolAtLocation(declaration.name);
	if (symbol === undefined) {
		return undefined;
	}
	function resolvedSymbol(value: ts.Symbol | undefined): ts.Symbol | undefined {
		return value !== undefined && value.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(value) : value;
	}
	const arguments_: ts.Expression[] = [];
	for (const source of sources) {
		function visit(node: ts.Node): void {
			if (
				ts.isCallExpression(node)
				&& ts.isIdentifier(node.expression)
				&& resolvedSymbol(checker.getSymbolAtLocation(node.expression)) === resolvedSymbol(symbol)
			) {
				const argument = node.arguments[callback.parameters.indexOf(parameter)];
				if (argument !== undefined) {
					arguments_.push(argument);
				}
			}
			ts.forEachChild(node, visit);
		}
		visit(source);
	}
	return arguments_;
}

export function ownedServiceParameters(checker: ts.TypeChecker, sources: readonly ts.SourceFile[]) {
	const states = new Set<ts.Node>();
	for (const source of sources) {
		for (const definition of directServiceDefinitions(source, serviceAssemblyImports(source).definitions)) {
			const config = definition.arguments[0];
			const methods = config !== undefined && ts.isObjectLiteralExpression(config) ? serviceProperty(config, "methods") : undefined;
			const state = methods !== undefined && ts.isArrowFunction(methods) ? methods.parameters[0] : undefined;
			if (state !== undefined) {
				states.add(state);
			}
		}
	}
	const originates = parameterOrigins(checker, sources);
	const results = new Map<ts.ParameterDeclaration, boolean>();
	const wrappedArguments = new Map<ts.ParameterDeclaration, readonly ts.Expression[] | undefined>();
	function owned(parameter: ts.ParameterDeclaration, active: ReadonlySet<ts.ParameterDeclaration> = new Set()): boolean {
		if (active.has(parameter)) {
			return false;
		}
		const cached = results.get(parameter);
		if (cached !== undefined) {
			return cached;
		}
		const visited = new Set([...active, parameter]);
		const wrapped = wrappedArguments.has(parameter) ? wrappedArguments.get(parameter) : wrappedCallArguments(checker, parameter, sources);
		wrappedArguments.set(parameter, wrapped);
		if (wrapped !== undefined) {
			const result = wrapped.length > 0 && wrapped.every((argument) => ownedValue(argument, visited));
			results.set(parameter, result);
			return result;
		}
		const result = originates(parameter, (value) => ownedValue(value, visited));
		results.set(parameter, result);
		return result;
	}
	function rootParameter(value: ts.Node): ts.ParameterDeclaration | undefined {
		let origin = value;
		while (ts.isPropertyAccessExpression(origin) || ts.isElementAccessExpression(origin)) {
			origin = origin.expression;
		}
		const root = ts.isIdentifier(origin) ? checker.getSymbolAtLocation(origin)?.valueDeclaration : undefined;
		return root !== undefined && ts.isParameter(root) ? root : undefined;
	}
	function isOwnedState(value: ts.Node): boolean {
		const declaration = ts.isIdentifier(value) ? checker.getSymbolAtLocation(value)?.valueDeclaration : value;
		const root = rootParameter(value);
		return (declaration !== undefined && states.has(declaration)) || (root !== undefined && states.has(root));
	}
	function ownedValue(value: ts.Node, active: ReadonlySet<ts.ParameterDeclaration>): boolean {
		if (isOwnedState(value)) {
			return true;
		}
		const root = rootParameter(value);
		if (root !== undefined && owned(root, active)) {
			return true;
		}
		if (!ts.isExpression(value)) {
			return false;
		}
		const resolved = resolvedValue(checker, value);
		return resolved !== value && ts.isExpression(resolved) && ownedValue(resolved, active);
	}
	return (parameter: ts.ParameterDeclaration): boolean => states.size > 0 && owned(parameter);
}
