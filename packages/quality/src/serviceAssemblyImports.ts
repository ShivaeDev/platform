import ts from "typescript";

export interface ServiceAssemblyImports {
	readonly definitions: ReadonlySet<string>;
	readonly effects: ReadonlySet<string>;
	readonly generics: ReadonlySet<string>;
	readonly unsupported: readonly ts.Node[];
	readonly values: ReadonlySet<string>;
}

function importedNames(clause: ts.ImportClause, name: string): readonly string[] {
	const bindings = clause.namedBindings;
	if (bindings === undefined || !ts.isNamedImports(bindings)) {
		return [];
	}
	return bindings.elements.flatMap((element) =>
		!element.isTypeOnly && (element.propertyName?.text ?? element.name.text) === name ? [element.name.text] : [],
	);
}

function valueImport(statement: ts.Statement):
	| {
			readonly clause: ts.ImportClause;
			readonly module: string;
	  }
	| undefined {
	if (
		!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))
		|| statement.importClause === undefined
		|| statement.importClause.isTypeOnly
	) {
		return;
	}
	return {
		clause: statement.importClause,
		module: statement.moduleSpecifier.text,
	};
}

function collectDefinitionImport(clause: ts.ImportClause, definitions: Set<string>, unsupported: ts.Node[]): void {
	if (clause.namedBindings !== undefined && ts.isNamespaceImport(clause.namedBindings)) {
		unsupported.push(clause.namedBindings);
	}
	for (const name of importedNames(clause, "defineService")) {
		definitions.add(name);
	}
}

function collectValueImports(clause: ts.ImportClause, values: Set<string>): void {
	if (clause.namedBindings === undefined || !ts.isNamedImports(clause.namedBindings)) {
		return;
	}
	for (const element of clause.namedBindings.elements) {
		if (!element.isTypeOnly) {
			values.add(element.name.text);
		}
	}
}

function effectNames(clause: ts.ImportClause, module: string): readonly string[] {
	if (module === "effect") {
		return importedNames(clause, "Effect");
	}
	const bindings = clause.namedBindings;
	return module === "effect/Effect" && bindings !== undefined && ts.isNamespaceImport(bindings) ? [bindings.name.text] : [];
}

export function serviceAssemblyImports(source: ts.SourceFile): ServiceAssemblyImports {
	const definitions = new Set<string>();
	const effects = new Set<string>();
	const generics = new Set<string>();
	const unsupported: ts.Node[] = [];
	const values = new Set<string>();
	for (const statement of source.statements) {
		const imported = valueImport(statement);
		if (imported === undefined) {
			continue;
		}
		collectValueImports(imported.clause, values);
		if (imported.module === "@shivaedev/service/defineService.ts") {
			collectDefinitionImport(imported.clause, definitions, unsupported);
		}
		if (imported.module === "@shivaedev/service/genericMethod.ts") {
			for (const name of importedNames(imported.clause, "genericMethod")) {
				generics.add(name);
			}
		}
		for (const name of effectNames(imported.clause, imported.module)) {
			effects.add(name);
		}
	}
	return { definitions, effects, generics, unsupported, values };
}
