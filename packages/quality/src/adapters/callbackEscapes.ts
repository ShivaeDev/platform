import type ts from "typescript";

export function callbackEscapes(checker: ts.TypeChecker, call: ts.CallExpression, callback: ts.Node): boolean {
	const seen = new Set<ts.Type>();
	function exposed(type: ts.Type): boolean {
		if (seen.has(type) || ["~effect/Effect", "~effect/Stream", "~effect/Layer"].some((brand) => type.getProperty(brand) !== undefined)) {
			return false;
		}
		seen.add(type);
		if (type.isUnionOrIntersection()) {
			return type.types.some(exposed);
		}
		if (
			type
				.getCallSignatures()
				.some((signature) => signature.parameters.some((parameter) => parameter.declarations?.some((declaration) => declaration.parent === callback)))
		) {
			return true;
		}
		return (
			checker.getIndexInfosOfType(type).some((index) => exposed(index.type))
			|| type
				.getProperties()
				.some(
					(property) =>
						(property.declarations ?? []).some((declaration) => declaration.getSourceFile() === callback.getSourceFile())
						&& exposed(checker.getTypeOfSymbol(property)),
				)
		);
	}
	return exposed(checker.getTypeAtLocation(call));
}
