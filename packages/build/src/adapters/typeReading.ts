import ts from "typescript";
import type { DeclaredClass } from "#facts.ts";

export interface TypeReading {
	readonly checker: ts.TypeChecker;
	readonly program: ts.Program;
	// Refuses the type at a path with what to write instead, and returns undefined so a caller can stop there.
	readonly refuse: (type: ts.Type, path: string, instead: string) => undefined;
}

export function declaredIn(type: ts.Type, module: string): boolean {
	const pattern = new RegExp(`[/\\\\]effect[/\\\\](?:dist|src)[/\\\\]${module}\\.(?:d\\.)?ts$`, "u");
	return (type.aliasSymbol ?? type.getSymbol())?.declarations?.some((declaration) => pattern.test(declaration.getSourceFile().fileName)) === true;
}

export function isLibraryType(reading: TypeReading, type: ts.Type, name: string): boolean {
	const symbol = type.getSymbol();
	return (
		symbol?.name === name
		&& symbol.declarations?.some((declaration) => reading.program.isSourceFileDefaultLibrary(declaration.getSourceFile())) === true
	);
}

export function declaredClass(reading: TypeReading, symbol: ts.Symbol): DeclaredClass | undefined {
	const declaration = symbol.declarations?.find(ts.isClassDeclaration);
	if (declaration === undefined) {
		return undefined;
	}
	const file = declaration.getSourceFile();
	const module = reading.checker.getSymbolAtLocation(file);
	const exported =
		module === undefined
			? undefined
			: reading.checker
					.getExportsOfModule(module)
					.find((candidate) => (candidate.flags & ts.SymbolFlags.Alias ? reading.checker.getAliasedSymbol(candidate) : candidate) === symbol);
	return { className: symbol.name, exportName: exported?.name, file: file.fileName };
}

export function isSchemaClass(reading: TypeReading, symbol: ts.Symbol): boolean {
	const declaration = symbol.declarations?.find(ts.isClassDeclaration);
	if (declaration === undefined) {
		return false;
	}
	const staticSide = reading.checker.getTypeOfSymbolAtLocation(symbol, declaration);
	return staticSide.getProperty("ast") !== undefined && staticSide.getProperty("fields") !== undefined;
}

// Array, tuple and generic interface instances, such as Effect<A, E, R>, are references that carry their type arguments.
export function isReference(type: ts.Type): type is ts.TypeReference {
	return "target" in type;
}

export function typeArguments(checker: ts.TypeChecker, type: ts.Type): readonly ts.Type[] {
	return isReference(type) ? checker.getTypeArguments(type) : [];
}

export function literalOf(type: ts.Type): string | number | undefined {
	return type.isStringLiteral() || type.isNumberLiteral() ? type.value : undefined;
}
