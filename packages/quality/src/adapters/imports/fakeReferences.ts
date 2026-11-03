import { join, relative } from "node:path";
import ts from "typescript";
import { isTestCode } from "#naming/testName.ts";
import { memberName, unwrapped } from "#rules/stories/syntax.ts";

export interface FakeReference {
	readonly module: string;
	readonly names: readonly string[];
}

function imported(node: ts.Node): FakeReference | undefined {
	if (ts.isImportSpecifier(node)) {
		const declaration = node.parent.parent.parent;
		return ts.isStringLiteral(declaration.moduleSpecifier)
			? { module: declaration.moduleSpecifier.text, names: [(node.propertyName ?? node.name).text] }
			: undefined;
	}
	if (ts.isNamespaceImport(node) || ts.isImportClause(node)) {
		const declaration = ts.isNamespaceImport(node) ? node.parent.parent : node.parent;
		return ts.isStringLiteral(declaration.moduleSpecifier)
			? { module: declaration.moduleSpecifier.text, names: ts.isImportClause(node) ? ["default"] : [] }
			: undefined;
	}
	return undefined;
}

export function fakeReferences(program: ts.Program, root: string) {
	const checker = program.getTypeChecker();
	function declarationOf(node: ts.Node): ts.Declaration | undefined {
		const symbol = checker.getSymbolAtLocation(node);
		return (symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol)?.declarations?.[0];
	}
	function initializer(node: ts.Node): ts.Expression | undefined {
		const declared = declarationOf(node);
		return declared !== undefined && ts.isVariableDeclaration(declared) ? declared.initializer : undefined;
	}
	function concreteService(node: ts.Expression): boolean {
		const value = initializer(node);
		return (
			value !== undefined
			&& ts.isCallExpression(value)
			&& memberName(value.expression) === undefined
			&& reference(value.expression)?.names.includes("defineService") === true
		);
	}
	function reference(expression: ts.Expression, seen = new Set<ts.Node>()): FakeReference | undefined {
		const node = unwrapped(expression);
		if (seen.has(node)) {
			return undefined;
		}
		seen.add(node);
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			const base = reference(node.expression, seen);
			const name = memberName(node);
			return base === undefined || name === undefined ? undefined : { ...base, names: [...base.names, name] };
		}
		return binding(node, seen);
	}

	function binding(node: ts.Node, seen: Set<ts.Node>): FakeReference | undefined {
		const symbol = checker.getSymbolAtLocation(node);
		for (const declared of symbol?.declarations ?? []) {
			const importedName = imported(declared);
			if (importedName !== undefined) {
				return importedName;
			}
			if (ts.isVariableDeclaration(declared) && declared.initializer !== undefined) {
				return reference(declared.initializer, seen);
			}
		}
		return symbol === undefined && ts.isIdentifier(node) && node.text === "vi" ? { module: "vitest", names: ["vi"] } : undefined;
	}

	function ownedPath(file: string | undefined, includeTests: boolean): string | undefined {
		const local = file === undefined ? undefined : relative(root, file);
		if (local === undefined || local.startsWith("../") || local.includes("/node_modules/")) {
			return undefined;
		}
		return !isTestCode(local) || includeTests ? local : undefined;
	}

	function owner(expression: ts.Expression, importedTests = false): string | undefined {
		const node = unwrapped(expression);
		let symbol = checker.getSymbolAtLocation(node);
		const aliased = symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0;
		if (symbol !== undefined && aliased) {
			symbol = checker.getAliasedSymbol(symbol);
		}
		const path = symbol?.declarations?.[0]?.getSourceFile().fileName;
		const local = ownedPath(path, importedTests && aliased);
		if (local !== undefined) {
			return local;
		}
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			return owner(node.expression, importedTests);
		}
		const declaration = symbol?.valueDeclaration;
		return declaration !== undefined && ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined
			? owner(declaration.initializer, importedTests)
			: undefined;
	}
	return { concreteService, initializer, owner, reference, source: (path: string) => program.getSourceFile(join(root, path)) };
}

export function fakeApi(reference: FakeReference | undefined): string | undefined {
	if (reference === undefined) {
		return undefined;
	}
	const { module, names } = reference;
	if ((module === "vitest" || module === "@effect/vitest") && names[0] === "vi" && names.length === 2) {
		return `vi.${names[1]}`;
	}
	const path = module.startsWith("effect/") ? [module.slice("effect/".length), ...names] : names;
	return (module === "effect" || module.startsWith("effect/")) && path.length === 2 ? path.join(".") : undefined;
}
