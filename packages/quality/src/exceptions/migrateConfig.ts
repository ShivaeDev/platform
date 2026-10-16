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
	return property.name !== undefined && (ts.isStringLiteral(property.name) || ts.isIdentifier(property.name)) ? property.name.text : undefined;
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
		if (name !== "rules" || !hasDeclarations || !ts.isPropertyAssignment(property)) {
			return [{ name: name ?? "", text: property.getFullText(source).trim() }];
		}
		if (!ts.isObjectLiteralExpression(property.initializer) || property.initializer.properties.some(ts.isSpreadAssignment)) {
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
