import ts from "typescript";
import type { Declaration } from "#rules/suppressions/biome/declarations.ts";

function nameOf(property: ts.ObjectLiteralElementLike): string | undefined {
	return ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name) ? property.name.text : undefined;
}

function strip(node: ts.Expression, paths: readonly (readonly string[])[]): ts.Expression {
	if (!ts.isObjectLiteralExpression(node)) {
		return node;
	}
	const properties = node.properties.flatMap((property) => {
		const name = nameOf(property);
		const matching = paths.filter((path) => path[0] === name);
		if (!ts.isPropertyAssignment(property) || matching.length === 0) {
			return [property];
		}
		if (matching.some((path) => path.length === 1)) {
			return [];
		}
		const value = strip(
			property.initializer,
			matching.map((path) => path.slice(1)),
		);
		return ts.isObjectLiteralExpression(value) && value.properties.length === 0
			? []
			: [ts.factory.updatePropertyAssignment(property, property.name, value)];
	});
	return ts.factory.updateObjectLiteralExpression(node, properties);
}

function settingPath(rule: string): readonly string[] {
	const [tool = "", group = "", name = ""] = rule.split("/");
	return tool === "files" ? ["files", "includes"] : [tool === "lint" ? "linter" : "assist", tool === "lint" ? "rules" : "actions", group, name];
}

export function migrateBiome(text: string, file: string, declarations: readonly Declaration[]): string {
	const source = ts.parseJsonText(file, text);
	const root = source.statements[0]?.expression;
	if (ts.parseConfigFileTextToJson(file, text).error !== undefined || root === undefined || !ts.isObjectLiteralExpression(root)) {
		throw new Error(`Cannot migrate invalid Biome config ${file}. Repair it, then run quality exceptions migrate again.`);
	}
	const globals = declarations.filter((entry) => entry.rule === "files/includes");
	const stripped = strip(
		root,
		globals.map((entry) => settingPath(entry.rule)),
	);
	if (!ts.isObjectLiteralExpression(stripped)) {
		throw new Error(`Cannot migrate ${file}.`);
	}
	const properties = stripped.properties.flatMap((property) => {
		if (nameOf(property) !== "overrides" || !ts.isPropertyAssignment(property) || !ts.isArrayLiteralExpression(property.initializer)) {
			return [property];
		}
		const overrides = property.initializer.elements.flatMap((override) => {
			if (!ts.isObjectLiteralExpression(override)) {
				return [override];
			}
			const includes = override.properties.find((item) => nameOf(item) === "includes");
			const paths =
				includes !== undefined && ts.isPropertyAssignment(includes) && ts.isArrayLiteralExpression(includes.initializer)
					? includes.initializer.elements.filter(ts.isStringLiteral).map((item) => item.text)
					: ["**"];
			const matching = declarations.filter(
				(entry) => entry.rule !== "files/includes" && entry.includes.length === paths.length && entry.includes.every((path) => paths.includes(path)),
			);
			const updated = strip(
				override,
				matching.map((entry) => settingPath(entry.rule)),
			);
			return ts.isObjectLiteralExpression(updated) && updated.properties.every((item) => nameOf(item) === "includes") ? [] : [updated];
		});
		return overrides.length === 0
			? []
			: [ts.factory.updatePropertyAssignment(property, property.name, ts.factory.updateArrayLiteralExpression(property.initializer, overrides))];
	});
	return `${ts.createPrinter().printNode(ts.EmitHint.Expression, ts.factory.updateObjectLiteralExpression(root, properties), source)}\n`;
}
