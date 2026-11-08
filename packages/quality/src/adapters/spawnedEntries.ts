import { posix } from "node:path";
import ts from "typescript";
import { buildEntryPaths } from "#adapters/buildEntryPaths.ts";
import { buildEntryValue, buildOption } from "#adapters/buildEntryValue.ts";
import { importedCall } from "#adapters/importedCall.ts";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

const COMMANDS = new Set(["spawn", "spawnSync", "execFile", "execFileSync", "fork"]);

function entriesOf(call: ts.CallExpression, cwd: string, root: string): readonly string[] {
	const imported = importedCall(call);
	if (imported === undefined || !/^(?:node:)?child_process$/u.test(imported.module) || !COMMANDS.has(imported.name)) {
		return [];
	}
	const options = call.arguments[2] === undefined ? undefined : buildEntryValue(call.arguments[2]);
	const working = options !== undefined && ts.isObjectLiteralExpression(options) ? buildOption(options, "cwd") : undefined;
	const directories = working === undefined ? [cwd] : buildEntryPaths(working, cwd, root);
	const targets = call.arguments.slice(0, 2).flatMap((argument) => buildEntryPaths(argument, cwd, root));
	return targets.flatMap((target) => directories.map((folder) => posix.resolve(cwd, folder, target)));
}

export function spawnedEntries(file: SourceFile, root: string, directory: string): readonly string[] {
	const source = file.text.includes("child_process") ? parse(file) : undefined;
	if (source === undefined) {
		return [];
	}
	const entries: string[] = [];
	const cwd = posix.join(root, directory);
	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node)) {
			entries.push(...entriesOf(node, cwd, root).map((target) => posix.relative(root, target)));
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return entries;
}
