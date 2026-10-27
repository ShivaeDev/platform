import ts from "typescript";
import { ownsParameters } from "#rules/effect/ownsParameters.ts";

export function publicFunctions(sources: readonly ts.SourceFile[], checker: ts.TypeChecker, surface: (type: ts.Type) => void): void {
	const local = new Set(sources);
	const owned = ownsParameters(checker, local);
	const visited = new Set<ts.Symbol>();
	function wrapped(value: ts.CallExpression): void {
		if (checker.getTypeAtLocation(value).getCallSignatures().length === 0) {
			return;
		}
		for (const argument of value.arguments) {
			surface(checker.getTypeAtLocation(argument));
		}
	}

	function variable(declaration: ts.VariableDeclaration, symbol: ts.Symbol): void {
		surface(checker.getTypeOfSymbol(symbol));
		if (declaration.initializer !== undefined && ts.isCallExpression(declaration.initializer)) {
			wrapped(declaration.initializer);
		}
	}

	function declarationSurface(declaration: ts.Declaration, target: ts.Symbol): void {
		if (!(local.has(declaration.getSourceFile()) && owned(declaration))) {
			return;
		}
		if (ts.isBindingElement(declaration)) {
			surface(checker.getTypeOfSymbol(target));
		}
		if (ts.isExportAssignment(declaration)) {
			surface(checker.getTypeAtLocation(declaration.expression));
		}
		if (ts.isInterfaceDeclaration(declaration)) {
			surface(checker.getDeclaredTypeOfSymbol(target));
		}
		if (ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration)) {
			surface(checker.getTypeOfSymbol(target));
		}
		if (ts.isVariableDeclaration(declaration)) {
			variable(declaration, target);
		}
	}
	function exported(symbol: ts.Symbol | undefined): void {
		if (symbol === undefined) {
			return;
		}
		const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
		if (visited.has(target)) {
			return;
		}
		visited.add(target);
		for (const declaration of target.declarations ?? []) {
			declarationSurface(declaration, target);
		}
	}
	function publicClasses(node: ts.Node): void {
		if (ts.isClassDeclaration(node) && node.name !== undefined && owned(node)) {
			surface(checker.getTypeAtLocation(node.name));
		}
		ts.forEachChild(node, publicClasses);
	}
	for (const source of sources) {
		publicClasses(source);
		const module = checker.getSymbolAtLocation(source);
		for (const symbol of module === undefined ? [] : checker.getExportsOfModule(module)) {
			exported(symbol);
		}
	}
}
