import ts from "typescript";
import { wildcardMatches } from "./glob.ts";

export type Ambient = (specifier: string, projectFiles: ReadonlySet<string>) => boolean;

const WILDCARD = "*";

function isPattern(name: string): boolean {
	return name !== WILDCARD && name.split(WILDCARD).length <= 2;
}

function declaredIn(source: ts.SourceFile): readonly string[] {
	if (ts.isExternalModule(source)) {
		return [];
	}
	return source.statements.flatMap((statement) =>
		ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name) && isPattern(statement.name.text) ? [statement.name.text] : [],
	);
}

function isBare(specifier: string): boolean {
	return !(specifier.startsWith(".") || specifier.startsWith("/"));
}

// A module declared in a script, not a module, is ambient: it exists for the files of the project that includes the script.
export function ambientModules(sources: readonly { readonly path: string; readonly syntax: ts.SourceFile }[]): Ambient {
	const declarations = sources.flatMap(({ path, syntax }) => {
		const patterns = declaredIn(syntax);
		return patterns.length === 0 ? [] : [{ path, patterns }];
	});
	return (specifier, projectFiles) =>
		isBare(specifier)
		&& declarations.some(({ path, patterns }) => projectFiles.has(path) && patterns.some((pattern) => wildcardMatches(pattern, specifier)));
}
