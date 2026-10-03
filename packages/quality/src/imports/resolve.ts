import { realpathSync } from "node:fs";
import { isBuiltin } from "node:module";
import { relative } from "node:path";
import ts from "typescript";
import { posix } from "../inventory/ignore-scope.ts";
import type { Ambient } from "./ambient.ts";
import type { Project } from "./projects.ts";

export type Endpoint = { readonly kind: "file"; readonly path: string } | { readonly kind: "external"; readonly specifier: string };

const NODE_PREFIX = "node:";

const ASSET_DECLARATION = /\.d(?<extension>\.[^./]+)\.ts$/u;

const QUERY = /\?.*$/u;

export function builtinName(specifier: string): string | undefined {
	if (!isBuiltin(specifier)) {
		return undefined;
	}
	return specifier.startsWith(NODE_PREFIX) ? specifier : `${NODE_PREFIX}${specifier}`;
}

function assetOf(declaration: string): string {
	return declaration.replace(ASSET_DECLARATION, "$<extension>");
}

// TypeScript resolves an import of a stylesheet or an image once the asset has a declaration beside it, so this host lets every asset have one.
const assetHost: ts.ModuleResolutionHost = {
	...ts.sys,
	fileExists: (path) => ts.sys.fileExists(path) || (ASSET_DECLARATION.test(path) && ts.sys.fileExists(assetOf(path))),
};

function resolvedPath(specifier: string, from: string, project: Project): string | undefined {
	const runtime = ts.resolveModuleName(specifier, from, project.options, ts.sys, project.cache).resolvedModule;
	if (runtime !== undefined) {
		return runtime.resolvedFileName;
	}
	const declared = ts.resolveModuleName(specifier, from, project.typesOptions, assetHost, project.typesCache).resolvedModule?.resolvedFileName;
	return declared !== undefined && !ts.sys.fileExists(declared) ? assetOf(declared) : declared;
}

function endpointAt(root: string, specifier: string, path: string): Endpoint {
	const real = posix(relative(root, realpathSync(path)));
	return real.startsWith("../") || real.split("/").includes("node_modules") ? { kind: "external", specifier } : { kind: "file", path: real };
}

export function resolveImport(root: string, ambient: Ambient, specifier: string, from: string, project: Project): Endpoint | undefined {
	const builtin = builtinName(specifier);
	if (builtin !== undefined) {
		return { kind: "external", specifier: builtin };
	}
	const path = resolvedPath(specifier.replace(QUERY, ""), from, project);
	if (path !== undefined) {
		return endpointAt(root, specifier, path);
	}
	return ambient(specifier) ? { kind: "external", specifier } : undefined;
}
