import ts from "typescript";
import type { ExceptionDeclaration } from "./declaration.ts";

function objectOf(expression: ts.Expression): ts.ObjectLiteralExpression | undefined {
	if (ts.isObjectLiteralExpression(expression)) {
		return expression;
	}
	if (ts.isCallExpression(expression) && expression.arguments[0] !== undefined) {
		return objectOf(expression.arguments[0]);
	}
	return ts.isSatisfiesExpression(expression) || ts.isAsExpression(expression) || ts.isParenthesizedExpression(expression)
		? objectOf(expression.expression)
		: undefined;
}

function nameOf(property: ts.ObjectLiteralElementLike): string | undefined {
	const name = property.name;
	if (name === undefined) {
		return undefined;
	}
	if (ts.isComputedPropertyName(name)) {
		if (ts.isStringLiteral(name.expression) || ts.isNoSubstitutionTemplateLiteral(name.expression) || ts.isNumericLiteral(name.expression)) {
			return name.expression.text;
		}
		throw new Error("Cannot migrate a computed property automatically. Use literal property keys, then run quality exceptions migrate again.");
	}
	return ts.isStringLiteral(name) || ts.isIdentifier(name) || ts.isNumericLiteral(name) ? name.text : undefined;
}

export function migrateConfig(text: string | undefined, file: string, exceptions: readonly ExceptionDeclaration[], hasDeclarations: boolean): string {
	if (text === undefined) {
		return `export default { exceptions: ${JSON.stringify(exceptions, null, "\t")} };\n`;
	}
	const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const exported = source.statements.find(ts.isExportAssignment);
	const object = exported === undefined ? undefined : objectOf(exported.expression);
	if (object === undefined || object.properties.some(ts.isSpreadAssignment)) {
		throw new Error(
			`Cannot migrate ${file} automatically. Export an object or defineConfig({ ... }) without spreads, then run quality exceptions migrate again.`,
		);
	}
	const properties = object.properties.flatMap((property) => {
		const name = nameOf(property);
		if (name === "registry" || name === "exceptions") {
			return [];
		}
		if (name !== "rules" || !hasDeclarations) {
			return [{ name: name ?? "", text: property.getFullText(source).trim() }];
		}
		if (
			!(ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.initializer))
			|| property.initializer.properties.some(ts.isSpreadAssignment)
		) {
			throw new Error(`Inline the rules object in ${file}, then run quality exceptions migrate again.`);
		}
		const rules = property.initializer.properties.filter((rule) => nameOf(rule) !== "suppressions/biome-overrides");
		return rules.length === 0 ? [] : [{ name: "rules", text: `rules: {\n${rules.map((rule) => rule.getFullText(source).trim()).join(",\n")}\n}` }];
	});
	const next = properties.map((property) => property.text);
	const index = properties.findIndex((property) => property.name > "exceptions");
	next.splice(index < 0 ? next.length : index, 0, `exceptions: ${JSON.stringify(exceptions, null, "\t")}`);
	const replacement = `{\n${next.join(",\n")}\n}`;
	return text.slice(0, object.getStart(source)) + replacement + text.slice(object.end);
}
