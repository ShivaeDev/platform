import { Result } from "effect";
import ts from "typescript";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { MigrationFailure } from "#exceptions/MigrationFailure.ts";

interface KeptProperty {
	readonly name: string;
	readonly text: string;
}

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

function nameOf(property: ts.ObjectLiteralElementLike): Result.Result<string | undefined, MigrationFailure> {
	const name = property.name;
	if (name === undefined) {
		return Result.succeed(undefined);
	}
	if (ts.isComputedPropertyName(name)) {
		if (ts.isStringLiteral(name.expression) || ts.isNoSubstitutionTemplateLiteral(name.expression) || ts.isNumericLiteral(name.expression)) {
			return Result.succeed(name.expression.text);
		}
		return Result.fail(
			new MigrationFailure({
				message: "Cannot migrate a computed property automatically. Use literal property keys, then run quality exceptions migrate again.",
			}),
		);
	}
	return Result.succeed(ts.isStringLiteral(name) || ts.isIdentifier(name) || ts.isNumericLiteral(name) ? name.text : undefined);
}

function keptRules(initializer: ts.ObjectLiteralExpression, source: ts.SourceFile): Result.Result<readonly KeptProperty[], MigrationFailure> {
	return Result.map(
		Result.all(initializer.properties.map((rule) => Result.map(nameOf(rule), (name) => (name === "suppressions/biome-overrides" ? [] : [rule])))),
		(kept) => {
			const rules = kept.flat();
			return rules.length === 0 ? [] : [{ name: "rules", text: `rules: {\n${rules.map((rule) => rule.getFullText(source).trim()).join(",\n")}\n}` }];
		},
	);
}

function keptProperty(
	property: ts.ObjectLiteralElementLike,
	source: ts.SourceFile,
	file: string,
	hasDeclarations: boolean,
): Result.Result<readonly KeptProperty[], MigrationFailure> {
	return Result.flatMap(nameOf(property), (name): Result.Result<readonly KeptProperty[], MigrationFailure> => {
		if (name === "registry" || name === "exceptions") {
			return Result.succeed([]);
		}
		if (name !== "rules" || !hasDeclarations) {
			return Result.succeed([{ name: name ?? "", text: property.getFullText(source).trim() }]);
		}
		if (
			!(ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.initializer))
			|| property.initializer.properties.some(ts.isSpreadAssignment)
		) {
			return Result.fail(new MigrationFailure({ message: `Inline the rules object in ${file}, then run quality exceptions migrate again.` }));
		}
		return keptRules(property.initializer, source);
	});
}

export function migrateConfig(
	text: string | undefined,
	file: string,
	exceptions: readonly ExceptionDeclaration[],
	hasDeclarations: boolean,
): Result.Result<string, MigrationFailure> {
	if (text === undefined) {
		return Result.succeed(`export default { exceptions: ${JSON.stringify(exceptions, null, "\t")} };\n`);
	}
	const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const exported = source.statements.find(ts.isExportAssignment);
	const object = exported === undefined ? undefined : objectOf(exported.expression);
	if (object === undefined || object.properties.some(ts.isSpreadAssignment)) {
		return Result.fail(
			new MigrationFailure({
				message: `Cannot migrate ${file} automatically. Export an object or defineConfig({ ... }) without spreads, then run quality exceptions migrate again.`,
			}),
		);
	}
	return Result.map(Result.all(object.properties.map((property) => keptProperty(property, source, file, hasDeclarations))), (kept) => {
		const properties = kept.flat();
		const next = properties.map((property) => property.text);
		const index = properties.findIndex((property) => property.name > "exceptions");
		next.splice(index < 0 ? next.length : index, 0, `exceptions: ${JSON.stringify(exceptions, null, "\t")}`);
		const replacement = `{\n${next.join(",\n")}\n}`;
		return text.slice(0, object.getStart(source)) + replacement + text.slice(object.end);
	});
}
