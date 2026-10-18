import { dirname, isAbsolute, join, resolve } from "node:path";
import ts from "typescript";

const PROBE = "__quality_shadcn__.tsx";

function capture(pattern: string, alias: string): string | undefined {
	const star = pattern.indexOf("*");
	if (star === -1) {
		return pattern === alias ? "" : undefined;
	}
	const prefix = pattern.slice(0, star);
	const suffix = pattern.slice(star + 1);
	return alias.startsWith(prefix) && alias.endsWith(suffix)
		? alias.slice(prefix.length, suffix.length === 0 ? undefined : -suffix.length)
		: undefined;
}

function pathTarget(alias: string, options: ts.CompilerOptions, directory: string): string | undefined {
	const pathsBase = Reflect.get(options, "pathsBasePath");
	const base = options.baseUrl ?? (typeof pathsBase === "string" ? pathsBase : directory);
	const patterns = Object.entries(options.paths ?? {}).toSorted(([left], [right]) => right.indexOf("*") - left.indexOf("*"));
	const exact = options.paths?.[alias]?.[0];
	if (exact !== undefined) {
		return resolve(base, exact);
	}
	for (const [pattern, targets] of patterns) {
		const captured = capture(pattern, alias);
		const target = targets[0];
		if (captured !== undefined && target !== undefined) {
			return resolve(base, target.replace("*", captured));
		}
	}
	return undefined;
}

export function shadcnAlias(directory: string, alias: string): string {
	if (alias.startsWith(".") || isAbsolute(alias)) {
		return resolve(directory, alias);
	}
	const config = ts.findConfigFile(directory, ts.sys.fileExists);
	const parsed =
		config === undefined
			? undefined
			: ts.getParsedCommandLineOfConfigFile(
					config,
					{},
					{
						...ts.sys,
						onUnRecoverableConfigFileDiagnostic: () => undefined,
					},
				);
	if (parsed?.errors.length) {
		throw new Error(
			ts.formatDiagnostics(parsed.errors, {
				getCanonicalFileName: (file) => file,
				getCurrentDirectory: () => directory,
				getNewLine: () => "\n",
			}),
		);
	}
	const options = parsed?.options ?? {};
	const target = pathTarget(alias, options, config === undefined ? directory : dirname(config));
	if (target !== undefined) {
		return target;
	}
	if (!alias.startsWith("#")) {
		throw new Error(`Cannot resolve shadcn UI alias "${alias}" from ${directory}. Check tsconfig paths.`);
	}
	// A synthetic child lets TypeScript resolve directory aliases through package imports without requiring a stock component to exist.
	const resolved = ts.resolveModuleName(
		`${alias}/${PROBE}`,
		join(directory, "components.tsx"),
		{
			...options,
			customConditions: ["source", ...(options.customConditions ?? [])],
			moduleResolution: ts.ModuleResolutionKind.Bundler,
		},
		{
			...ts.sys,
			directoryExists: () => true,
			fileExists: (file) => file.endsWith(`/${PROBE}`) || ts.sys.fileExists(file),
		},
	).resolvedModule;
	if (resolved === undefined) {
		throw new Error(`Cannot resolve shadcn UI alias "${alias}" from ${directory}. Check tsconfig paths or package imports.`);
	}
	return dirname(resolved.resolvedFileName);
}
