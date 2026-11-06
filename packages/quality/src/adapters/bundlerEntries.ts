import { posix } from "node:path";
import ts from "typescript";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { buildEntryPaths } from "./buildEntryPaths.ts";
import { buildEntryValue, buildOption } from "./buildEntryValue.ts";
import { importedCall } from "./importedCall.ts";

const ESBUILD = new Set(["build", "buildSync", "context"]);

function entryOption(call: ts.CallExpression): string | undefined {
	const expression = call.expression;
	if (ts.isPropertyAccessExpression(expression) && expression.expression.getText() === "Bun" && expression.name.text === "build") {
		return "entrypoints";
	}
	const imported = importedCall(call);
	return imported?.module === "esbuild" && ESBUILD.has(imported.name) ? "entryPoints" : undefined;
}

function entriesOf(call: ts.CallExpression, file: string, cwd: string): readonly string[] {
	const option = entryOption(call);
	const [argument] = call.arguments;
	const options = argument === undefined ? undefined : buildEntryValue(argument);
	if (option === undefined || options === undefined || !ts.isObjectLiteralExpression(options)) {
		return [];
	}
	const directory = buildOption(options, "absWorkingDir");
	const working = directory === undefined ? cwd : buildEntryPaths(directory, cwd, file)[0];
	if (working === undefined) {
		return [];
	}
	const entries = buildOption(options, option);
	return entries === undefined ? [] : buildEntryPaths(entries, cwd, file).map((path) => posix.resolve(cwd, working, path));
}

export function bundlerEntries(file: SourceFile, root: string, directory: string): readonly string[] {
	if (!(file.text.includes("esbuild") || file.text.includes("Bun"))) {
		return [];
	}
	const source = parse(file);
	if (source === undefined) {
		return [];
	}
	const entries: string[] = [];
	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node)) {
			entries.push(...entriesOf(node, posix.join(root, file.path), posix.join(root, directory)).map((path) => posix.relative(root, path)));
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return entries;
}
