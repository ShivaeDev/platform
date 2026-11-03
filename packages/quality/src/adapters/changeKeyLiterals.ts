import ts from "typescript";
import { unwrapped } from "#rules/stories/syntax.ts";

function literal(node: ts.Expression): readonly ts.Node[] {
	const value = unwrapped(node);
	return ts.isStringLiteralLike(value) ? [value] : [];
}

function propertyName(name: ts.PropertyName): string | undefined {
	return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined;
}

function keyObject(node: ts.ObjectLiteralExpression): readonly ts.Node[] {
	const typed = node.properties.some((property) => ts.isPropertyAssignment(property) && propertyName(property.name) === "_tag");
	return node.properties.flatMap((property) => {
		if (ts.isShorthandPropertyAssignment(property)) {
			return [property.name];
		}
		if (ts.isSpreadAssignment(property)) {
			return changeKeyLiterals(property.expression);
		}
		if (!ts.isPropertyAssignment(property)) {
			return [];
		}
		if (typed) {
			return ["collection", "field"].includes(propertyName(property.name) ?? "") ? literal(property.initializer) : [];
		}
		return ts.isComputedPropertyName(property.name) ? literal(property.name.expression) : [property.name];
	});
}

export function changeKeyLiterals(expression: ts.Expression, nameOnly = false): readonly ts.Node[] {
	const value = unwrapped(expression);
	if (ts.isConditionalExpression(value)) {
		return [...changeKeyLiterals(value.whenTrue, nameOnly), ...changeKeyLiterals(value.whenFalse, nameOnly)];
	}
	if (nameOnly || ts.isStringLiteralLike(value)) {
		return literal(value);
	}
	if (ts.isArrayLiteralExpression(value)) {
		return value.elements.flatMap((element) => changeKeyLiterals(element));
	}
	if (ts.isObjectLiteralExpression(value)) {
		return keyObject(value);
	}
	return ts.isSpreadElement(value) ? changeKeyLiterals(value.expression, nameOnly) : [];
}
