import ts from "typescript";

export function nonEmptyContext(checker: ts.TypeChecker, context: ts.Type): boolean {
	const variance = context.getProperty("_Services");
	const parameter = variance === undefined ? undefined : checker.getTypeOfSymbol(variance).getCallSignatures()[0]?.parameters[0];
	if (parameter === undefined) {
		return false;
	}
	const required = checker.getTypeOfSymbol(parameter);
	return !((checker.getBaseConstraintOfType(required) ?? required).flags & ts.TypeFlags.Never);
}
