import ts from "typescript";

export interface DocumentedImport {
	readonly name?: string;
	readonly source: string;
	readonly specifier: string;
	readonly typeOnly?: boolean;
}

export function packageName(specifier: string): string {
	return specifier.split("/").slice(0, 2).join("/");
}

function declarationImports(statement: ts.Statement, source: string): DocumentedImport[] {
	if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))) {
		return [];
	}
	const specifier = statement.moduleSpecifier.text;
	if (!specifier.startsWith("@shivaedev/")) {
		return [];
	}
	const imports: DocumentedImport[] = [{ source, specifier }];
	const clause = statement.importClause;
	if (clause?.name !== undefined) {
		imports.push({ name: "default", source, specifier, typeOnly: clause.isTypeOnly });
	}
	if (clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)) {
		for (const entry of clause.namedBindings.elements) {
			imports.push({ name: (entry.propertyName ?? entry.name).text, source, specifier, typeOnly: clause.isTypeOnly || entry.isTypeOnly });
		}
	}
	return imports;
}

export function documentedImports(markdown: string, source: string, owner?: string): DocumentedImport[] {
	const imports: DocumentedImport[] = [];
	for (const block of markdown.matchAll(/```(?:ts|tsx|typescript)\n(?<code>[\s\S]*?)```/gu)) {
		const file = ts.createSourceFile(source, block.groups?.code ?? "", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
		imports.push(...file.statements.flatMap((statement) => declarationImports(statement, source)));
	}
	for (const match of markdown.matchAll(/`(?<specifier>@shivaedev\/[\w-]+\/[\w./-]+\.ts)`/gu)) {
		imports.push({ source, specifier: match.groups?.specifier ?? "" });
	}
	for (const match of markdown.matchAll(/`(?<name>\w+)` from `(?<specifier>@shivaedev\/[\w-]+\/[\w./-]+\.ts)`/gu)) {
		imports.push({ name: match.groups?.name ?? "", source, specifier: match.groups?.specifier ?? "" });
	}
	if (owner !== undefined) {
		for (const match of markdown.matchAll(/^\| `(?!@)(?<path>[\w./-]+\.ts)` \|/gmu)) {
			imports.push({ source, specifier: `${owner}/${match.groups?.path}` });
		}
	}
	return imports.filter((entry, index) => imports.findIndex((other) => JSON.stringify(other) === JSON.stringify(entry)) === index);
}

export function importProbe(entry: DocumentedImport, index: number): string {
	const specifier = JSON.stringify(entry.specifier);
	return entry.name === undefined
		? `export * as entry${index} from ${specifier};`
		: `export { ${entry.typeOnly ? "type " : ""}${entry.name} as entry${index} } from ${specifier};`;
}
