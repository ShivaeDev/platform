import ts from "typescript";
import { parameterOrigins } from "#adapters/parameterOrigins.ts";
import { serviceAssemblyImports } from "#adapters/serviceAssemblyImports.ts";
import { directServiceDefinitions, serviceProperty } from "#adapters/serviceAssemblySyntax.ts";

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
	return (parameter: ts.ParameterDeclaration): boolean =>
		states.size > 0
		&& originates(parameter, (value) => {
			const declaration = ts.isIdentifier(value) ? checker.getSymbolAtLocation(value)?.valueDeclaration : value;
			return declaration !== undefined && states.has(declaration);
		});
}
