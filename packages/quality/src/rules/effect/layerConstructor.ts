import ts from "typescript";
import { returnValues } from "#rules/stories/returnValues.ts";

function declaredLayer(checker: ts.TypeChecker, declaration: ts.Signature["declaration"]): boolean {
	const type = declaration?.type;
	if (type === undefined || !ts.isTypeReferenceNode(type)) {
		return false;
	}
	const symbol = checker.getSymbolAtLocation(type.typeName);
	if (symbol === undefined) {
		return false;
	}
	const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
	return checker.getDeclaredTypeOfSymbol(target).getProperty("~effect/Layer") !== undefined;
}

export function layerConstructor(checker: ts.TypeChecker, declaration: NonNullable<ts.Signature["declaration"]>): boolean {
	if (declaredLayer(checker, declaration)) {
		return true;
	}
	if (
		ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Async
		|| ("asteriskToken" in declaration && declaration.asteriskToken !== undefined)
	) {
		return false;
	}
	const returns = returnValues(declaration);
	// Native Layer constructors declare the result independently of their inputs;
	// resolving their instantiated result can expand an entire application graph.
	return (
		returns.length > 0
		&& returns.every((value) => {
			if (value === undefined || !ts.isCallExpression(value)) {
				return false;
			}
			const signatures = checker.getTypeAtLocation(value.expression).getCallSignatures();
			return signatures.length > 0 && signatures.every((signature) => declaredLayer(checker, signature.declaration));
		})
	);
}
