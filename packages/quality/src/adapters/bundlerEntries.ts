import { posix } from "node:path";
import ts from "typescript";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { buildEntryPaths } from "./buildEntryPaths.ts";
import { type BuildBindings, buildEntryValue, buildOption } from "./buildEntryValue.ts";
import { buildArguments, buildHelper } from "./buildHelper.ts";
import { importedCall } from "./importedCall.ts";

const ESBUILD = new Set(["build", "buildSync", "context"]);

function callbackBody(node: ts.Node): ts.ConciseBody | undefined {
	return (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isCallExpression(node.parent) && node.parent.arguments.includes(node)
		? node.body
		: undefined;
}

function entryOption(call: ts.CallExpression): string | undefined {
	const expression = call.expression;
	if (ts.isPropertyAccessExpression(expression) && expression.expression.getText() === "Bun" && expression.name.text === "build") {
		return "entrypoints";
	}
	const imported = importedCall(call);
	return imported?.module === "esbuild" && ESBUILD.has(imported.name) ? "entryPoints" : undefined;
}

function entriesOf(call: ts.CallExpression, file: string, cwd: string, bindings: BuildBindings): readonly string[] {
	const option = entryOption(call);
	const [argument] = call.arguments;
	const options = argument === undefined ? undefined : buildEntryValue(argument, new Set(), bindings);
	if (option === undefined || options === undefined || !ts.isObjectLiteralExpression(options)) {
		return [];
	}
	const directory = buildOption(options, "absWorkingDir");
	const working = directory === undefined ? cwd : buildEntryPaths(directory, cwd, file, new Set(), bindings)[0];
	if (working === undefined) {
		return [];
	}
	const entries = buildOption(options, option);
	return entries === undefined ? [] : buildEntryPaths(entries, cwd, file, new Set(), bindings).map((path) => posix.resolve(cwd, working, path));
}

export function bundlerEntries(
	file: SourceFile,
	root: string,
	directory: string,
	sources: ReadonlyMap<string, ts.SourceFile> = new Map(),
): readonly string[] {
	const source = sources.get(file.path) ?? parse(file);
	if (source === undefined) {
		return [];
	}
	const entries: string[] = [];
	function visit(node: ts.Node, bindings: BuildBindings, active: ReadonlySet<ts.Node>): void {
		if (ts.isFunctionLike(node)) {
			const body = callbackBody(node);
			if (body !== undefined) {
				visit(body, bindings, active);
			}
			return;
		}
		if (ts.isCallExpression(node)) {
			entries.push(
				...entriesOf(node, posix.join(root, node.getSourceFile().fileName), posix.join(root, directory), bindings).map((path) =>
					posix.relative(root, path),
				),
			);
			const helper = buildHelper(node, sources, bindings);
			if (helper?.body !== undefined && !active.has(helper)) {
				visit(helper.body, buildArguments(helper, node, bindings), new Set([...active, helper]));
			}
		}
		ts.forEachChild(node, (child) => visit(child, bindings, active));
	}
	visit(source, new Map(), new Set());
	return entries;
}
