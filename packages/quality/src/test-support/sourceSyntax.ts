import ts from "typescript";

export function sourceSyntax(text: string, path = "src/main.ts"): ts.SourceFile {
	return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
}
