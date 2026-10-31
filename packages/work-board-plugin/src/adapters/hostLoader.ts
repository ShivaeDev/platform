import ts from "typescript";
import { engineUseRefusal, nextToRefusal, onCallRefusal, type TopLevel, topLevel } from "#adapters/hostCalls.ts";

export interface Emitted {
	readonly name: string;
	readonly text: string;
}

const READ_LIMIT = 1_048_576;

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
	visit(node);
	ts.forEachChild(node, (child) => walk(child, visit));
}

function at(file: ts.SourceFile, node: ts.Node, refusal: string): string {
	return `${file.fileName}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}: ${refusal}`;
}

function registerRefusals(file: ts.SourceFile, functions: ReadonlyMap<string, ts.FunctionDeclaration>): string[] {
	const declared = functions.get("register");
	const exported = file.statements.some(
		(statement) =>
			(statement === declared && declared.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
			|| (ts.isExportDeclaration(statement)
				&& statement.moduleSpecifier === undefined
				&& statement.exportClause !== undefined
				&& ts.isNamedExports(statement.exportClause)
				&& statement.exportClause.elements.some(
					(element) => element.name.text === "register" && (element.propertyName ?? element.name).text === "register",
				)),
	);
	if (declared === undefined || !exported) {
		return [`${file.fileName}: register is not exported as the function register(on) declared at the top of this file`];
	}
	const [on] = declared.parameters;
	if (on === undefined || !ts.isIdentifier(on.name) || on.name.text !== "on") {
		return [at(file, declared, "register does not take on as its first parameter")];
	}
	return [];
}

function nodeRefusal(node: ts.Node, names: TopLevel): string | undefined {
	if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "on") {
		return onCallRefusal(node);
	}
	if (ts.isIdentifier(node) && node.text === "$") {
		return engineUseRefusal(node, names);
	}
	if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "next" && node.name.text === "to") {
		return nextToRefusal(node);
	}
	return undefined;
}

function entryRefusals(file: ts.SourceFile): string[] {
	const names = topLevel(file);
	const refusals = registerRefusals(file, names.functions);
	walk(file, (node) => {
		const refusal = nodeRefusal(node, names);
		if (refusal !== undefined) {
			refusals.push(at(file, node, refusal));
		}
	});
	return refusals;
}

function fileRefusals(file: ts.SourceFile): string[] {
	const refusals: string[] = [];
	for (const statement of file.statements) {
		if (
			(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
			&& statement.moduleSpecifier !== undefined
			&& ts.isStringLiteral(statement.moduleSpecifier)
			&& statement.moduleSpecifier.text !== "claude-code"
			&& !statement.moduleSpecifier.text.startsWith("./")
		) {
			refusals.push(at(file, statement, `imports "${statement.moduleSpecifier.text}", which is neither claude-code nor a file beside it`));
		}
	}
	walk(file, (node) => {
		if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
			refusals.push(at(file, node, "holds a dynamic import()"));
		}
	});
	return refusals;
}

export function hostRefusals(entry: string, files: readonly Emitted[]): string[] {
	return files.flatMap(({ name, text }) => {
		if (new TextEncoder().encode(text).byteLength > READ_LIMIT) {
			return [`${name}: is over ${READ_LIMIT} bytes, which the host does not read`];
		}
		const file = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		return name === entry ? [...entryRefusals(file), ...fileRefusals(file)] : fileRefusals(file);
	});
}
