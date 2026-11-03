import ts from "typescript";
import { unwrapped } from "#rules/stories/syntax.ts";

function literal(node: ts.Expression): readonly ts.Node[] {
	const value = unwrapped(node);
	return ts.isStringLiteralLike(value) ? [value] : [];
}

function propertyName(name: ts.PropertyName): string | undefined {
	return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined;
}

function typedKey(node: ts.ObjectLiteralExpression): boolean {
	return node.properties.some((property) => {
		if (!ts.isPropertyAssignment(property) || propertyName(property.name) !== "_tag") {
			return false;
		}
		const tag = unwrapped(property.initializer);
		return ts.isStringLiteralLike(tag) && ["List", "Item", "Bucket"].includes(tag.text);
	});
}

function keyObject(node: ts.ObjectLiteralExpression, record: boolean): readonly ts.Node[] {
	const typed = typedKey(node);
	if (!(typed || record)) {
		return [];
	}
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

export function changeKeyLiterals(expression: ts.Expression, nameOnly = false, record = true): readonly ts.Node[] {
	const value = unwrapped(expression);
	if (ts.isConditionalExpression(value)) {
		return [...changeKeyLiterals(value.whenTrue, nameOnly, record), ...changeKeyLiterals(value.whenFalse, nameOnly, record)];
	}
	if (nameOnly || ts.isStringLiteralLike(value)) {
		return literal(value);
	}
	if (ts.isArrayLiteralExpression(value)) {
		return value.elements.flatMap((element) => changeKeyLiterals(element, false, false));
	}
	if (ts.isObjectLiteralExpression(value)) {
		return keyObject(value, record);
	}
	return ts.isSpreadElement(value) ? changeKeyLiterals(value.expression, nameOnly, record) : [];
}
