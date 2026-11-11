import ts from "typescript";

export function presenceCheck(checker: ts.TypeChecker, value: ts.Expression): boolean {
	const comparison = value.parent;
	if (!ts.isBinaryExpression(comparison)) {
		return false;
	}
	const operator = comparison.operatorToken.kind;
	const other = comparison.left === value ? comparison.right : comparison.left;
	return (
		(operator === ts.SyntaxKind.EqualsEqualsEqualsToken
			|| operator === ts.SyntaxKind.ExclamationEqualsEqualsToken
			|| operator === ts.SyntaxKind.EqualsEqualsToken
			|| operator === ts.SyntaxKind.ExclamationEqualsToken)
		&& (checker.getTypeAtLocation(other).flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) !== 0
	);
}
