import ts from "typescript";
import { ownExports } from "#naming/ownExports.ts";
import { parse } from "#rules/parse.ts";

function isDefault(statement: ts.Statement): boolean {
	if (ts.isExportAssignment(statement)) {
		return !statement.isExportEquals;
	}
	const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
	return modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
}

function reexports(statement: ts.Statement): boolean {
	return ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined;
}

// A module that re-exports another may export any name that module does, so only a module without re-exports gets a definite answer.
export function exportsName(path: string, text: string, name: string): boolean | undefined {
	const source = parse({ lines: [], path, text });
	if (source === undefined || source.statements.some(reexports)) {
		return undefined;
	}
	if (name === "default") {
		return source.statements.some(isDefault);
	}
	return ownExports(source).some((entry) => entry.name === name);
}
