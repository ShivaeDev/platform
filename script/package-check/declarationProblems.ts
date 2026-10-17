import { join } from "node:path";
import ts from "typescript";

const DECLARED = ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface | ts.SymbolFlags.Class | ts.SymbolFlags.Enum;

const OWN_PACKAGE = /\/node_modules\/@shivaedev\//u;

const quietHost: ts.ParseConfigFileHost = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined };

const formatHost: ts.FormatDiagnosticsHost = {
	getCanonicalFileName: (fileName) => fileName,
	getCurrentDirectory: ts.sys.getCurrentDirectory,
	getNewLine: () => "\n",
};

function owned(file: ts.SourceFile): boolean {
	return !file.fileName.includes("/node_modules/") || OWN_PACKAGE.test(file.fileName);
}

function typesOf(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Type[] {
	const types: ts.Type[] = [];
	if (symbol.flags & ts.SymbolFlags.Value) {
		types.push(checker.getTypeOfSymbol(symbol));
	}
	if (symbol.flags & DECLARED) {
		types.push(checker.getDeclaredTypeOfSymbol(symbol));
	}
	return types;
}

// An import a declaration file cannot resolve types its names as any, so a broken export reads as any to the consumer.
function anyExports(program: ts.Program, entries: string): string[] {
	const checker = program.getTypeChecker();
	const problems: string[] = [];
	for (const statement of program.getSourceFile(entries)?.statements ?? []) {
		if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))) {
			continue;
		}
		const specifier = statement.moduleSpecifier.text;
		const moduleSymbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
		if (moduleSymbol === undefined) {
			problems.push(`${specifier} does not resolve`);
			continue;
		}
		for (const exported of checker.getExportsOfModule(moduleSymbol)) {
			const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
			if (typesOf(checker, symbol).some((type) => type.flags & ts.TypeFlags.Any)) {
				problems.push(`${specifier} exports ${exported.name} as any`);
			}
		}
	}
	return problems;
}

// Third-party declarations are left out: some fail the consumer's strict options, and Platform cannot fix them.
export function declarationProblems(consumer: string, config: string, entries: string): string[] {
	const parsed = ts.getParsedCommandLineOfConfigFile(join(consumer, config), { skipLibCheck: false }, quietHost);
	if (parsed === undefined) {
		return [`cannot read ${config}`];
	}
	const program = ts.createProgram({ options: parsed.options, rootNames: parsed.fileNames });
	const diagnostics = [
		...program.getOptionsDiagnostics(),
		...program.getGlobalDiagnostics(),
		...program
			.getSourceFiles()
			.filter(owned)
			.flatMap((file) => [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)]),
	];
	const problems = diagnostics.length === 0 ? [] : [`${config}:\n${ts.formatDiagnostics(diagnostics, formatHost)}`];
	return [...problems, ...anyExports(program, join(consumer, entries)).map((problem) => `${config}: ${problem}`)];
}
