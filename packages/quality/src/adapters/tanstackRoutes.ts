import { Schema } from "effect";
import ts from "typescript";

const RouterOptions = Schema.Struct({
	routeFileIgnorePattern: Schema.optionalKey(Schema.String),
	routeFileIgnorePrefix: Schema.optionalKey(Schema.String),
	routeFilePrefix: Schema.optionalKey(Schema.String),
	routesDirectory: Schema.optionalKey(Schema.NonEmptyString),
});

export type RouterOptions = typeof RouterOptions.Type;

const OPTIONS = new Set(["routeFileIgnorePattern", "routeFileIgnorePrefix", "routeFilePrefix", "routesDirectory"]);
const PLUGINS = new Set(["tanstackRouter", "TanStackRouterVite"]);
const PACKAGES = new Set(["@tanstack/router-plugin/vite", "@tanstack/router-vite-plugin"]);

function pluginNames(source: ts.SourceFile): ReadonlySet<string> {
	return new Set(
		source.statements.flatMap((statement) => {
			if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && PACKAGES.has(statement.moduleSpecifier.text))) {
				return [];
			}
			const clause = statement.importClause;
			const bindings = clause?.namedBindings;
			return [
				...(clause?.name === undefined ? [] : [clause.name.text]),
				...(bindings !== undefined && ts.isNamedImports(bindings)
					? bindings.elements.filter((entry) => PLUGINS.has((entry.propertyName ?? entry.name).text)).map((entry) => entry.name.text)
					: []),
			];
		}),
	);
}

function literalOptions(node: ts.Expression | undefined): RouterOptions {
	if (node === undefined) {
		return {};
	}
	if (!ts.isObjectLiteralExpression(node)) {
		throw new Error("Use literal TanStack Router options or move them to tsr.config.json so Quality can read the route folder.");
	}
	const entries = node.properties.flatMap((property): readonly (readonly [string, string])[] => {
		if (ts.isSpreadAssignment(property)) {
			throw new Error("Move spread TanStack Router options to tsr.config.json so Quality can read the route folder.");
		}
		const name = property.name;
		if (name === undefined || !(ts.isIdentifier(name) || ts.isStringLiteral(name)) || !OPTIONS.has(name.text)) {
			return [];
		}
		if (!(ts.isPropertyAssignment(property) && ts.isStringLiteralLike(property.initializer))) {
			throw new Error(`TanStack Router ${name.text} must be a literal string for Quality to read it.`);
		}
		return [[name.text, property.initializer.text]];
	});
	return Schema.decodeUnknownSync(RouterOptions)(Object.fromEntries(entries));
}

export function tanstackRoutes(path: string, text: string): readonly RouterOptions[] {
	if (path.endsWith("tsr.config.json")) {
		return [Schema.decodeUnknownSync(Schema.fromJsonString(RouterOptions))(text)];
	}
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
	const names = pluginNames(source);
	const options: RouterOptions[] = [];
	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)) {
			options.push(literalOptions(node.arguments[0]));
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return options;
}
