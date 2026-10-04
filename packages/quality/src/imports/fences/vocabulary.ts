import type { Endpoint } from "#imports/resolve.ts";
import { type Compiler, holdsFiles, packageNamed, trimmed } from "./match.ts";
import type { Selector } from "./model.ts";

export interface Vocabulary {
	readonly folder: string;
	readonly subjectOf: (endpoint: Endpoint) => string | undefined;
}

const SOURCE_FOLDER = "src";

const MODULE_EXTENSION = /\.[cm]?[jt]sx?$/u;

function folderOf(compiler: Compiler, unit: Selector, where: string): string | undefined {
	if (unit.kind === "packages" && unit.names.length === 1) {
		const directory = packageNamed(compiler, unit.names[0] ?? "", where)?.directory;
		return directory === undefined ? undefined : [`${directory}/${SOURCE_FOLDER}`, directory].find((folder) => holdsFiles(compiler, folder));
	}
	if (unit.kind === "folders" && unit.paths.length === 1) {
		const folder = trimmed(unit.paths[0] ?? "");
		if (!holdsFiles(compiler, folder)) {
			compiler.issues.push(`${where}: folders("${folder}") holds no checked file`);
		}
		return folder;
	}
	compiler.issues.push(`${where}: of() takes one package or one folder`);
	return undefined;
}

function subjectAt(folder: string, path: string): string | undefined {
	if (!path.startsWith(`${folder}/`)) {
		return undefined;
	}
	const [first = ""] = path.slice(folder.length + 1).split("/");
	return first.replace(MODULE_EXTENSION, "");
}

export function compileVocabulary(compiler: Compiler, unit: Selector, subjects: readonly string[], where: string): Vocabulary | undefined {
	const folder = folderOf(compiler, unit, where);
	if (folder === undefined) {
		return undefined;
	}
	const known = new Set(compiler.scope.files.flatMap((file) => subjectAt(folder, file) ?? []));
	if (subjects.length === 0) {
		compiler.issues.push(`${where}: mayImportOnly() names no subject`);
	}
	for (const subject of subjects.filter((candidate) => !known.has(candidate))) {
		compiler.issues.push(`${where}: "${subject}" is no module or folder directly in ${folder}`);
	}
	return { folder, subjectOf: (endpoint) => (endpoint.kind === "file" ? subjectAt(folder, endpoint.path) : undefined) };
}
