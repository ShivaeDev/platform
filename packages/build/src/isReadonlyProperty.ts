import ts from "typescript";

// TypeScript 6 answers two questions only through internal API: whether a property is readonly (a mapped type such as
// Readonly<T> or a Schema's Type marks it in internal flags, not on a declaration) and which optional properties exclude
// undefined. The compiler-api catalog pins the version, so these stay put.
declare module "typescript" {
	function getCheckFlags(symbol: ts.Symbol): number;
	function getDeclarationModifierFlagsFromSymbol(symbol: ts.Symbol): ts.ModifierFlags;
	interface TypeChecker {
		getExactOptionalProperties: (type: ts.Type) => ts.Symbol[];
	}
}

const READONLY_CHECK_FLAG = 8;

export function isReadonlyProperty(property: ts.Symbol): boolean {
	return (
		(ts.getCheckFlags(property) & READONLY_CHECK_FLAG) !== 0
		|| ((property.flags & ts.SymbolFlags.Property) !== 0 && (ts.getDeclarationModifierFlagsFromSymbol(property) & ts.ModifierFlags.Readonly) !== 0)
	);
}
