import { realpathSync } from "node:fs";
import { isBuiltin } from "node:module";
import { dirname, join, relative } from "node:path";
import ts from "typescript";
import { posix } from "../inventory/ignore-scope.ts";
import type { Ambient } from "./ambient.ts";
import type { ImportRequest } from "./extract.ts";
import type { Project } from "./projects.ts";

export type Endpoint =
	| { readonly kind: "file"; readonly path: string }
	| { readonly kind: "external"; readonly package: string; readonly specifier: string };

const NODE_PREFIX = "node:";

const NODE_MODULES = "/node_modules/";

const ASSET_DECLARATION = /\.d(?<extension>\.[^./]+)\.ts$/u;

const DECLARATION = /\.d\.[cm]?ts$/u;

const QUERY = /\?.*$/u;

export function builtinName(specifier: string): string | undefined {
	if (!isBuiltin(specifier)) {
		return undefined;
	}
	return specifier.startsWith(NODE_PREFIX) ? specifier : `${NODE_PREFIX}${specifier}`;
}

const TYPES_SCOPE = "@types";

const TYPES_SCOPE_SEPARATOR = "__";

function typedName(name: string): string {
	return name.includes(TYPES_SCOPE_SEPARATOR) ? `@${name.replace(TYPES_SCOPE_SEPARATOR, "/")}` : name;
}

function nameAt(path: string): string {
	const [first = "", second] = path.split("/");
	if (second === undefined || !first.startsWith("@")) {
		return first;
	}
	return first === TYPES_SCOPE ? typedName(second) : `${first}/${second}`;
}

// The example checker and the graph name a package through this one function, so a fence example and a real import cannot disagree.
export function packageNameOf(specifier: string): string {
	return builtinName(specifier) ?? nameAt(specifier);
}

function assetOf(declaration: string): string {
	return declaration.replace(ASSET_DECLARATION, "$<extension>");
}

// TypeScript resolves an import of a stylesheet or an image once the asset has a declaration beside it, so this host lets every asset have one.
const assetHost: ts.ModuleResolutionHost = {
	...ts.sys,
	fileExists: (path) => ts.sys.fileExists(path) || (ASSET_DECLARATION.test(path) && ts.sys.fileExists(assetOf(path))),
};

function fitting(resolved: string, type: boolean): string | undefined {
	if (ASSET_DECLARATION.test(resolved) && ts.sys.fileExists(assetOf(resolved))) {
		return assetOf(resolved);
	}
	return type || !DECLARATION.test(resolved) ? resolved : undefined;
}

function located(request: ImportRequest, from: string, project: Project): string | undefined {
	const specifier = request.specifier.replace(QUERY, "");
	if (request.kind === "type-reference") {
		return ts.resolveTypeReferenceDirective(specifier, from, project.typesOptions, ts.sys).resolvedTypeReferenceDirective?.resolvedFileName;
	}
	if (request.kind === "path-reference") {
		const path = join(dirname(from), specifier);
		return ts.sys.fileExists(path) ? path : undefined;
	}
	return (
		ts.resolveModuleName(specifier, from, project.options, ts.sys, project.cache).resolvedModule?.resolvedFileName
		?? ts.resolveModuleName(specifier, from, project.typesOptions, assetHost, project.typesCache).resolvedModule?.resolvedFileName
	);
}

function resolvedPath(request: ImportRequest, from: string, project: Project): string | undefined {
	const path = located(request, from, project);
	return path === undefined ? undefined : fitting(path, request.type);
}

function endpointAt(root: string, specifier: string, path: string): Endpoint {
	const real = posix(realpathSync(path));
	const installed = real.lastIndexOf(NODE_MODULES);
	if (installed !== -1) {
		return { kind: "external", package: nameAt(real.slice(installed + NODE_MODULES.length)), specifier };
	}
	const inRoot = posix(relative(root, real));
	return inRoot.startsWith("../") ? { kind: "external", package: packageNameOf(specifier), specifier } : { kind: "file", path: inRoot };
}

export function resolveImport(root: string, ambient: Ambient, request: ImportRequest, from: string, project: Project): Endpoint | undefined {
	const builtin = builtinName(request.specifier);
	if (builtin !== undefined) {
		return { kind: "external", package: builtin, specifier: builtin };
	}
	const path = resolvedPath(request, from, project);
	if (path !== undefined) {
		return endpointAt(root, request.specifier, path);
	}
	return ambient(request.specifier, project.files)
		? { kind: "external", package: packageNameOf(request.specifier), specifier: request.specifier }
		: undefined;
}
