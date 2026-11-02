import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import errorsPackage from "@shivaedev/errors/package.json" with { type: "json" };
import { type Project, projectsFor } from "#adapters/imports/projects.ts";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { exportTargets } from "#imports/packageExports.ts";
import type { RuleInputs } from "#rule.ts";

export interface SharedErrorModule {
	readonly file: string;
	readonly specifier: string;
}

function targetFiles(directory: string, target: string): readonly string[] {
	const [prefix = "", suffix] = target.split("*");
	if (suffix === undefined) {
		return [join(directory, target)];
	}
	return ts.sys.readDirectory(directory, [".ts", ".js", ".mts", ".cts"], ["node_modules"], ["**/*"]).filter((path) => {
		const local = `./${relative(directory, path).replaceAll("\\", "/")}`;
		return local.startsWith(prefix) && local.endsWith(suffix);
	});
}

function moduleSpecifiers(directory: string, exports: object): readonly string[] {
	const specifiers = new Set<string>();
	for (const [key, value] of Object.entries(exports)) {
		for (const target of exportTargets(value)) {
			const [prefix = "", suffix] = target.split("*");
			for (const path of targetFiles(directory, target)) {
				const local = `./${relative(directory, path).replaceAll("\\", "/")}`;
				const subpath = suffix === undefined ? key : key.replace("*", local.slice(prefix.length, local.length - suffix.length));
				specifiers.add(`${errorsPackage.name}${subpath === "." ? "" : subpath.slice(1)}`);
			}
		}
	}
	return [...specifiers];
}

function resolveModules(specifiers: readonly string[], from: string, project: Project): readonly SharedErrorModule[] {
	return specifiers.flatMap((specifier) => {
		const resolved = ts.resolveModuleName(specifier, from, project.typesOptions, ts.sys, project.typesCache).resolvedModule;
		return resolved !== undefined && /\.[cm]?tsx?$/u.test(resolved.resolvedFileName) ? [{ file: resolved.resolvedFileName, specifier }] : [];
	});
}

export async function sharedErrorModules(inputs: RuleInputs): Promise<readonly SharedErrorModule[]> {
	const projectOf = projectsFor(inputs.root);
	const manifests = new Map<string, string>();
	for (const source of inputs.sources) {
		const from = join(inputs.root, source.path);
		const project = projectOf(from);
		const resolved = ts.resolveModuleName(
			`${errorsPackage.name}/package.json`,
			from,
			project.typesOptions,
			ts.sys,
			project.typesCache,
		).resolvedModule;
		if (resolved !== undefined) {
			manifests.set(resolved.resolvedFileName, from);
		}
	}
	if (manifests.size === 0) {
		manifests.set(createRequire(import.meta.url).resolve(`${errorsPackage.name}/package.json`), fileURLToPath(import.meta.url));
	}
	const modules = new Map<string, SharedErrorModule>();
	for (const [manifestPath, from] of manifests) {
		const manifest = await readPackageManifest(inputs.readText, relative(inputs.root, manifestPath));
		const exports = manifest?.exports;
		if (typeof exports !== "object" || exports === null || Array.isArray(exports)) {
			continue;
		}
		for (const module of resolveModules(moduleSpecifiers(dirname(manifestPath), exports), from, projectOf(from))) {
			modules.set(module.file, module);
		}
	}
	return [...modules.values()];
}
