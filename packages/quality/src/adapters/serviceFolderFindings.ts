import { posix } from "node:path";
import ts from "typescript";
import { serviceAssemblyImports } from "#adapters/serviceAssemblyImports.ts";
import { directServiceDefinitions, unwrapExpression } from "#adapters/serviceAssemblySyntax.ts";
import type { Finding, RuleInputs, SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

function exported(statement: ts.Statement): boolean {
	return ts.canHaveModifiers(statement) && (ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false);
}

function serviceShape(file: SourceFile): readonly Finding[] {
	const source = parse(file);
	if (source === undefined) {
		return [];
	}
	const definitions = directServiceDefinitions(source, serviceAssemblyImports(source).definitions);
	const runtime = source.statements.filter(
		(candidate) => exported(candidate) && !ts.isInterfaceDeclaration(candidate) && !ts.isTypeAliasDeclaration(candidate),
	);
	const [statement] = runtime;
	const declaration = statement !== undefined && ts.isVariableStatement(statement) ? statement.declarationList.declarations[0] : undefined;
	const valid =
		runtime.length === 1
		&& definitions.length === 1
		&& statement !== undefined
		&& ts.isVariableStatement(statement)
		&& (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
		&& statement.declarationList.declarations.length === 1
		&& declaration?.initializer !== undefined
		&& ts.isIdentifier(declaration.name)
		&& definitions[0] === unwrapExpression(declaration.initializer)
		&& !source.statements.some((node) => ts.isExportAssignment(node) || (ts.isExportDeclaration(node) && !node.isTypeOnly));
	return valid
		? []
		: [
				{
					file: file.path,
					line: 1,
					message:
						"Export exactly one named const initialized by a direct defineService call from service.ts. Move other runtime exports to their own files; type exports may stay.",
				},
			];
}

export function serviceFolderFindings({ files, sources }: RuleInputs): readonly Finding[] {
	const folders = new Set(
		files.flatMap((file) => {
			const match = /^(?<folder>(?:.*\/)?services\/[^/]+)\//u.exec(file)?.groups?.folder;
			return match === undefined ? [] : [match];
		}),
	);
	const findings: Finding[] = [];
	for (const folder of folders) {
		const service = `${folder}/service.ts`;
		if (!files.includes(service)) {
			findings.push({
				file: folder,
				message: "Give this service folder a service.ts that exports its defineService declaration. Keep operations in focused sibling files.",
			});
		}
	}
	return [
		...findings,
		...sources.filter((file) => posix.basename(file.path) === "service.ts" && folders.has(posix.dirname(file.path))).flatMap(serviceShape),
	];
}
