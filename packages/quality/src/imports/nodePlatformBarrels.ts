import ts from "typescript";
import { isTestCode } from "#naming/testName.ts";
import type { Finding, SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { specifierSites } from "./specifiers.ts";

const BARREL = "@effect/platform-node";

function subpaths(source: ts.SourceFile, start: number): readonly string[] | undefined {
	const statement = source.statements.find((node) => node.pos <= start && node.end > start);
	const bindings = statement !== undefined && ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined;
	if (bindings !== undefined && ts.isNamedImports(bindings)) {
		const values = bindings.elements.filter((element) => !element.isTypeOnly);
		return values.length === 0 && bindings.elements.length > 0
			? undefined
			: values.map((element) => `${BARREL}/${(element.propertyName ?? element.name).text}`);
	}
	if (
		statement !== undefined
		&& ts.isExportDeclaration(statement)
		&& statement.exportClause !== undefined
		&& ts.isNamedExports(statement.exportClause)
		&& statement.exportClause.elements.every((element) => element.isTypeOnly)
	) {
		return undefined;
	}
	return [];
}

export function nodePlatformBarrels(file: SourceFile): readonly Finding[] {
	const source = isTestCode(file.path) ? undefined : parse(file);
	if (source === undefined || source.isDeclarationFile) {
		return [];
	}
	return specifierSites(source)
		.filter((site) => site.specifier === BARREL && !site.type)
		.flatMap((site) => {
			const paths = subpaths(source, site.start);
			if (paths === undefined) {
				return [];
			}
			return [
				{
					file: file.path,
					line: site.line,
					message: `The ${BARREL} barrel loads optional integrations such as redis. Import module subpaths instead: ${paths.length > 0 ? paths.map((path) => `\`import * as ${path.slice(path.lastIndexOf("/") + 1)} from "${path}"\``).join("; ") : `\`import * as NodeServices from "${BARREL}/NodeServices"\` (choose the module you use)`}.`,
					subject: BARREL,
				},
			];
		});
}
