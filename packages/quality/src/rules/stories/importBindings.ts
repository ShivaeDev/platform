import ts from "typescript";

export interface ImportBinding {
	readonly imported: string;
	readonly module: string;
}

const NAMESPACE = "*";

export function importBindings(source: ts.SourceFile): ReadonlyMap<string, ImportBinding> {
	const bindings = new Map<string, ImportBinding>();
	for (const statement of source.statements) {
		if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))) {
			continue;
		}
		const module = statement.moduleSpecifier.text;
		const clause = statement.importClause;
		const named = clause?.namedBindings;
		if (named !== undefined && ts.isNamespaceImport(named)) {
			bindings.set(named.name.text, { imported: NAMESPACE, module });
		} else if (named !== undefined) {
			for (const element of named.elements) {
				bindings.set(element.name.text, { imported: (element.propertyName ?? element.name).text, module });
			}
		}
	}
	return bindings;
}

export function bindsModule(binding: ImportBinding | undefined, name: string, modules: readonly string[]): boolean {
	return (
		binding !== undefined
		&& (binding.imported === NAMESPACE
			? modules.some((module) => binding.module === `${module}/${name}`)
			: binding.imported === name && modules.includes(binding.module))
	);
}
