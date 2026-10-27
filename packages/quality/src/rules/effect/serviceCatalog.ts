import ts from "typescript";
import { serviceOrigin } from "#rules/effect/serviceOrigin.ts";
import { serviceTypes } from "#rules/effect/serviceTypes.ts";

export function serviceCatalog(program: ts.Program, checker: ts.TypeChecker) {
	const services = serviceTypes(checker);
	function imported(node: ts.ImportSpecifier | ts.NamespaceImport): void {
		const symbol = checker.getSymbolAtLocation(node.name);
		if (symbol === undefined) {
			return;
		}
		const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
		const candidates = target.flags & ts.SymbolFlags.Module ? checker.getExportsOfModule(target) : [target];
		for (const candidate of candidates) {
			const resolved = candidate.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(candidate) : candidate;
			if (serviceOrigin(checker, resolved)) {
				services.remember(checker.getTypeOfSymbol(resolved));
			}
		}
	}
	function referenced(node: ts.TypeReferenceNode): void {
		if (!serviceOrigin(checker, node.typeName)) {
			return;
		}
		const symbol = checker.getSymbolAtLocation(node.typeName);
		if (symbol === undefined) {
			return;
		}
		const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
		services.remember(checker.getTypeOfSymbol(target));
	}

	function discover(node: ts.Node): void {
		if (ts.isCallExpression(node) && serviceOrigin(checker, node.expression)) {
			services.remember(checker.getTypeAtLocation(node));
		}
		if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) {
			imported(node);
		}
		if (ts.isClassDeclaration(node) && node.name !== undefined && serviceOrigin(checker, node.name)) {
			services.remember(checker.getTypeAtLocation(node.name));
		}
		if (ts.isVariableDeclaration(node) && serviceOrigin(checker, node.name)) {
			services.remember(checker.getTypeAtLocation(node.name));
		}
		if (ts.isTypeReferenceNode(node)) {
			referenced(node);
		}
		ts.forEachChild(node, discover);
	}
	for (const source of program.getSourceFiles()) {
		if (!source.fileName.includes("/node_modules/") || source.fileName.includes("/@shivaedev/")) {
			discover(source);
		}
	}
	return services;
}
