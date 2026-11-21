import ts from "typescript";
import type { DeclaredClass } from "#facts.ts";

interface ExportedSchema {
	readonly declared: DeclaredClass;
	readonly type: ts.Type;
}

function importedFiles(checker: ts.TypeChecker, source: ts.SourceFile): readonly ts.SourceFile[] {
	return source.statements.flatMap((statement) => {
		const specifier = ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement) ? statement.moduleSpecifier : undefined;
		const declaration = specifier === undefined ? undefined : checker.getSymbolAtLocation(specifier)?.valueDeclaration;
		return declaration !== undefined && ts.isSourceFile(declaration) ? [declaration] : [];
	});
}

// An installed package's own imports are its business, so the walk takes the files the project imports from it and stops there.
function moduleGraph(program: ts.Program, file: string): readonly ts.SourceFile[] {
	const checker = program.getTypeChecker();
	const start = program.getSourceFile(file);
	const seen = new Set<ts.SourceFile>();
	const pending = start === undefined ? [] : [start];
	for (let source = pending.pop(); source !== undefined; source = pending.pop()) {
		if (!(seen.has(source) || program.isSourceFileDefaultLibrary(source))) {
			seen.add(source);
			if (!source.fileName.includes("/node_modules/")) {
				pending.push(...importedFiles(checker, source));
			}
		}
	}
	return [...seen];
}

function schemasIn(checker: ts.TypeChecker, source: ts.SourceFile): readonly (readonly [ts.Symbol, ExportedSchema])[] {
	const module = checker.getSymbolAtLocation(source);
	return (module === undefined ? [] : checker.getExportsOfModule(module)).flatMap((exported) => {
		const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
		const declaration = symbol.valueDeclaration;
		if (!(symbol.flags & ts.SymbolFlags.Variable) || declaration === undefined) {
			return [];
		}
		const value = checker.getTypeOfSymbol(symbol);
		const decoded = value.getProperty("Type");
		if (decoded === undefined || value.getProperty("ast") === undefined) {
			return [];
		}
		const declared = { className: exported.name, exportName: exported.name, file: declaration.getSourceFile().fileName };
		return [[symbol, { declared, type: checker.getTypeOfSymbol(decoded) }] as const];
	});
}

// The exported schemas of the files a module imports, directly or through others, so a branded type maps to the one whose Type
// it is. A schema re-exported by an index is imported from the file that declares it when the walk reaches that file too.
export function exportedSchemas(program: ts.Program, file: string): (type: ts.Type) => readonly DeclaredClass[] {
	let found: readonly ExportedSchema[] | undefined;
	function all() {
		if (found === undefined) {
			const bySymbol = new Map<ts.Symbol, ExportedSchema>();
			for (const [symbol, schema] of moduleGraph(program, file).flatMap((source) => schemasIn(program.getTypeChecker(), source))) {
				const known = bySymbol.get(symbol);
				if (known === undefined || schema.declared.file === symbol.valueDeclaration?.getSourceFile().fileName) {
					bySymbol.set(symbol, schema);
				}
			}
			found = [...bySymbol.values()];
		}
		return found;
	}
	return (type) => all().flatMap((schema) => (schema.type === type ? [schema.declared] : []));
}
