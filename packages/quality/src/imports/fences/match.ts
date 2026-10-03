import { builtinName, type Endpoint } from "../resolve.ts";
import { packageOf, type WorkspacePackage } from "../workspace.ts";
import type { Selector } from "./model.ts";

export interface PolicyScope {
	readonly files: readonly string[];
	readonly packages: readonly WorkspacePackage[];
}

export type Matcher = (endpoint: Endpoint) => boolean;

export interface Compiler {
	readonly issues: string[];
	readonly scope: PolicyScope;
}

const TRAILING_SLASHES = /\/+$/u;

function unscoped(name: string): string {
	return name.startsWith("@") ? name.slice(name.indexOf("/") + 1) : name;
}

export function trimmed(path: string): string {
	return path.replace(TRAILING_SLASHES, "");
}

export function holdsFiles(compiler: Compiler, folder: string): boolean {
	return compiler.scope.files.some((file) => file.startsWith(`${folder}/`));
}

export function packageNamed(compiler: Compiler, name: string, where: string): WorkspacePackage | undefined {
	const found = compiler.scope.packages.filter((candidate) => candidate.name === name || unscoped(candidate.name) === name);
	if (found.length !== 1) {
		compiler.issues.push(`${where}: ${found.length === 0 ? "no workspace package is named" : "more than one workspace package is named"} "${name}"`);
	}
	return found.length === 1 ? found[0] : undefined;
}

function checkNames(
	compiler: Compiler,
	where: string,
	kind: string,
	values: readonly string[],
	problemOf: (value: string) => string | undefined,
): void {
	if (values.length === 0) {
		compiler.issues.push(`${where}: ${kind}() names nothing`);
	}
	for (const value of values) {
		const problem = problemOf(value);
		if (problem !== undefined) {
			compiler.issues.push(`${where}: ${kind}("${value}") ${problem}`);
		}
	}
}

function fileWhere(accepts: (path: string) => boolean): Matcher {
	return (endpoint) => endpoint.kind === "file" && accepts(endpoint.path);
}

function externalWhere(accepts: (specifier: string) => boolean): Matcher {
	return (endpoint) => endpoint.kind === "external" && accepts(builtinName(endpoint.specifier) ?? endpoint.specifier);
}

function underAny(prefixes: readonly string[], value: string): boolean {
	return prefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`));
}

function compilePackages(compiler: Compiler, names: readonly string[], where: string): Matcher {
	checkNames(compiler, where, "packages", names, () => undefined);
	const directories = new Set(names.flatMap((name) => packageNamed(compiler, name, where)?.directory ?? []));
	return fileWhere((path) => directories.has(packageOf(compiler.scope.packages, path)?.directory ?? ""));
}

function compileFolders(compiler: Compiler, paths: readonly string[], where: string): Matcher {
	const folders = paths.map(trimmed);
	checkNames(compiler, where, "folders", folders, (folder) => (holdsFiles(compiler, folder) ? undefined : "holds no checked file"));
	return fileWhere((path) => folders.some((folder) => path.startsWith(`${folder}/`)));
}

function compileFiles(compiler: Compiler, paths: readonly string[], where: string): Matcher {
	checkNames(compiler, where, "files", paths, (path) => (compiler.scope.files.includes(path) ? undefined : "is no checked file"));
	return fileWhere((path) => paths.includes(path));
}

function compileModules(compiler: Compiler, names: readonly string[], where: string): Matcher {
	checkNames(compiler, where, "modules", names, (name) =>
		name.trim() === "" || name.startsWith(".") || name.startsWith("/") ? "is no package name" : undefined,
	);
	const normalized = names.map((name) => builtinName(name) ?? name);
	return externalWhere((specifier) => underAny(normalized, specifier));
}

function compileScopes(compiler: Compiler, names: readonly string[], where: string): Matcher {
	checkNames(compiler, where, "scopes", names, (name) =>
		name.startsWith("@") && name.length > 1 && !name.includes("/") ? undefined : 'is no scope such as "@types"',
	);
	return externalWhere((specifier) => names.some((name) => specifier.startsWith(`${name}/`)));
}

function compileWorkspace(compiler: Compiler, where: string): Matcher {
	if (compiler.scope.packages.length === 0) {
		compiler.issues.push(`${where}: workspace selects nothing, since the sources hold no named package.json`);
	}
	return fileWhere((path) => packageOf(compiler.scope.packages, path) !== undefined);
}

function compileGroup(compiler: Compiler, members: readonly Selector[], where: string, kind: string): readonly Matcher[] {
	if (members.length === 0) {
		compiler.issues.push(`${where}: ${kind}() names nothing`);
	}
	return members.map((member, index) => compile(compiler, member, `${where}.${kind}[${index}]`));
}

export function compile(compiler: Compiler, selector: Selector, where: string): Matcher {
	switch (selector.kind) {
		case "anything":
			return () => true;
		case "anyOf": {
			const members = compileGroup(compiler, selector.members, where, "anyOf");
			return (endpoint) => members.some((member) => member(endpoint));
		}
		case "except": {
			const base = compile(compiler, selector.base, where);
			const excluded = compileGroup(compiler, selector.excluded, where, "except");
			return (endpoint) => base(endpoint) && !excluded.some((member) => member(endpoint));
		}
		case "files":
			return compileFiles(compiler, selector.paths, where);
		case "folders":
			return compileFolders(compiler, selector.paths, where);
		case "modules":
			return compileModules(compiler, selector.names, where);
		case "packages":
			return compilePackages(compiler, selector.names, where);
		case "scopes":
			return compileScopes(compiler, selector.names, where);
		case "workspace":
			return compileWorkspace(compiler, where);
	}
}
