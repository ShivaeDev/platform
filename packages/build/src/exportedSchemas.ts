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

function exportsOf(checker: ts.TypeChecker, source: ts.SourceFile): readonly (readonly [string, ts.Symbol])[] {
	const module = checker.getSymbolAtLocation(source);
	return (module === undefined ? [] : checker.getExportsOfModule(module)).map(
		(exported) => [exported.name, exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported] as const,
	);
}

// A schema re-exported under another name is imported by the name its declaring file exports it as.
function schemaOf(checker: ts.TypeChecker, symbol: ts.Symbol): ExportedSchema | undefined {
	const declaration = symbol.valueDeclaration;
	const value = declaration === undefined || !(symbol.flags & ts.SymbolFlags.Variable) ? undefined : checker.getTypeOfSymbol(symbol);
	const decoded = value?.getProperty("Type");
	if (declaration === undefined || decoded === undefined || value?.getProperty("ast") === undefined) {
		return undefined;
	}
	const file = declaration.getSourceFile();
	const exportName = exportsOf(checker, file).find(([, exported]) => exported === symbol)?.[0];
	return exportName === undefined
		? undefined
		: { declared: { className: exportName, exportName, file: file.fileName }, type: checker.getTypeOfSymbol(decoded) };
}

export function exportedSchemas(program: ts.Program, file: string): (type: ts.Type) => readonly DeclaredClass[] {
	let found: readonly ExportedSchema[] | undefined;
	function all() {
		if (found === undefined) {
			const checker = program.getTypeChecker();
			const symbols = new Set(moduleGraph(program, file).flatMap((source) => exportsOf(checker, source).map(([, symbol]) => symbol)));
			found = [...symbols].flatMap((symbol) => schemaOf(checker, symbol) ?? []);
		}
		return found;
	}
	return (type) => all().flatMap((schema) => (schema.type === type ? [schema.declared] : []));
}
