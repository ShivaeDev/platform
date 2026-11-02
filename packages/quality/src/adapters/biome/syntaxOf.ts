import { readFileSync } from "node:fs";
import ts from "typescript";
import type { Syntax } from "#biome/syntax.ts";

export function syntaxOf(path: string): Syntax {
	const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
	const options: ts.CompilerOptions = { allowJs: true, noLib: true, noResolve: true };
	const host = ts.createCompilerHost(options);
	host.getSourceFile = (file) => (file === path ? source : undefined);
	const program = ts.createProgram([path], options, host);
	return { checker: program.getTypeChecker(), source };
}
