import ts from "typescript";

export type Ambient = (specifier: string) => boolean;

const WILDCARD = "*";

function declaredIn(source: ts.SourceFile): readonly string[] {
	return source.statements.flatMap((statement) =>
		ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name) ? [statement.name.text] : [],
	);
}

function matches(pattern: string, specifier: string): boolean {
	const star = pattern.indexOf(WILDCARD);
	if (star === -1) {
		return pattern === specifier;
	}
	const prefix = pattern.slice(0, star);
	const suffix = pattern.slice(star + 1);
	return specifier.length >= prefix.length + suffix.length && specifier.startsWith(prefix) && specifier.endsWith(suffix);
}

export function ambientModules(sources: readonly ts.SourceFile[]): Ambient {
	const patterns = [...new Set(sources.flatMap(declaredIn))];
	return (specifier) => patterns.some((pattern) => matches(pattern, specifier));
}
