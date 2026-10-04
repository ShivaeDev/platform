import { realpathSync } from "node:fs";
import { posix } from "node:path";
import ts from "typescript";

export type LoadsSource = (specifier: string, source: string) => boolean;

// Only options that pick a module stay: outDir, rootDir and the config file would let TypeScript map build output back to the source.
const RESOLUTION_OPTIONS = [
	"allowArbitraryExtensions",
	"allowImportingTsExtensions",
	"allowJs",
	"baseUrl",
	"customConditions",
	"module",
	"moduleResolution",
	"moduleSuffixes",
	"noDtsResolution",
	"paths",
	"pathsBasePath",
	"preserveSymlinks",
	"resolveJsonModule",
	"resolvePackageJsonExports",
	"resolvePackageJsonImports",
];

const DECLARATION_SUFFIX = /\.d\.[cm]?ts$/u;

function resolutionOnly(options: ts.CompilerOptions): ts.CompilerOptions {
	return Object.fromEntries(RESOLUTION_OPTIONS.flatMap((name) => (options[name] === undefined ? [] : [[name, options[name]]])));
}

function resolvedFile(specifier: string, from: string, options: ts.CompilerOptions): string | undefined {
	const resolved = ts.resolveModuleName(specifier, from, options, ts.sys).resolvedModule?.resolvedFileName;
	return resolved === undefined ? undefined : realpathSync(resolved);
}

function ownDeclaration(resolved: string, source: string): boolean {
	const stem = source.slice(0, source.length - posix.extname(source).length);
	return DECLARATION_SUFFIX.test(resolved) && resolved.replace(DECLARATION_SUFFIX, "") === stem;
}

// The project's own conditions must pick the source file for running and for types alike, with no source condition added.
export function loadsSource(project: { readonly options: ts.CompilerOptions; readonly typesOptions: ts.CompilerOptions }, from: string): LoadsSource {
	const runtime = resolutionOnly(project.options);
	const types = resolutionOnly(project.typesOptions);
	return (specifier, source) => {
		const typed = resolvedFile(specifier, from, types);
		return resolvedFile(specifier, from, runtime) === source && typed !== undefined && (typed === source || ownDeclaration(typed, source));
	};
}
