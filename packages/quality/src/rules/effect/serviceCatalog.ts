import ts from "typescript";
import servicePackage from "@shivaedev/service/package.json" with { type: "json" };
import { serviceOrigin } from "#rules/effect/serviceOrigin.ts";
import { serviceTypes } from "#rules/effect/serviceTypes.ts";

export function serviceCatalog(program: ts.Program, checker: ts.TypeChecker, packages: readonly string[] = [], initializerState = false) {
	const prefixes = [servicePackage.name, ...packages].map((name) => `${name.startsWith("@") ? name.split("/")[0] : name}/`);
	const services = serviceTypes(checker, initializerState);
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
				services.remember(checker.getTypeOfSymbol(resolved), resolved.name);
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
		services.remember(checker.getTypeOfSymbol(target), target.name);
	}

	function named(node: ts.Node): void {
		if (!(ts.isClassDeclaration(node) || ts.isVariableDeclaration(node)) || node.name === undefined || !serviceOrigin(checker, node.name)) {
			return;
		}
		const symbol = checker.getSymbolAtLocation(node.name);
		if (symbol !== undefined) {
			services.remember(checker.getTypeOfSymbol(symbol), symbol.name);
		}
	}

	function discover(node: ts.Node): void {
		if (ts.isCallExpression(node) && serviceOrigin(checker, node.expression)) {
			services.remember(checker.getTypeAtLocation(node));
		}
		if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) {
			imported(node);
		}
		named(node);
		if (ts.isTypeReferenceNode(node)) {
			referenced(node);
		}
		ts.forEachChild(node, discover);
	}
	for (const source of program.getSourceFiles()) {
		if (!source.fileName.includes("/node_modules/") || prefixes.some((prefix) => source.fileName.includes(`/${prefix}`))) {
			discover(source);
		}
	}
	return services;
}
