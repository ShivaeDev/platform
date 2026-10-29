import { documentedImports as documentedReferences } from "@shivaedev/quality/docs/documentedImports.ts";

export interface DocumentedImport {
	readonly name?: string;
	readonly source: string;
	readonly specifier: string;
	readonly typeOnly?: boolean;
}

export function packageName(specifier: string): string {
	return specifier.split("/").slice(0, 2).join("/");
}

export function documentedImports(markdown: string, source: string, owner?: string): DocumentedImport[] {
	const imports = documentedReferences(markdown, { owner, packages: (name) => name.startsWith("@shivaedev/") }).map(
		({ name, specifier, typeOnly }): DocumentedImport => ({
			...(name === undefined ? {} : { name }),
			source,
			specifier,
			...(typeOnly === undefined ? {} : { typeOnly }),
		}),
	);
	return imports.filter((entry, index) => imports.findIndex((other) => JSON.stringify(other) === JSON.stringify(entry)) === index);
}

export function importProbe(entry: DocumentedImport, index: number): string {
	const specifier = JSON.stringify(entry.specifier);
	return entry.name === undefined
		? `export * as entry${index} from ${specifier};`
		: `export { ${entry.typeOnly ? "type " : ""}${entry.name} as entry${index} } from ${specifier};`;
}
