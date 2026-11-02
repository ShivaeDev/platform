import ts from "typescript";

export function browserChecker(source: ts.SourceFile): ts.TypeChecker {
	const options: ts.CompilerOptions = { allowJs: true, noLib: true, noResolve: true };
	const host = ts.createCompilerHost(options);
	host.getSourceFile = (path) => (path === source.fileName ? source : undefined);
	return ts.createProgram([source.fileName], options, host).getTypeChecker();
}
