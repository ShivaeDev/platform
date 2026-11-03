import { isBuiltin } from "node:module";
import { posix } from "node:path";
import ts from "typescript";
import { exportTargets } from "#package-check/exports.ts";
import { conditionalTarget, importEntry } from "#package-check/imports.ts";
import { effectPackage, type Manifest } from "#package-check/model.ts";

export interface VendorType {
	readonly dependency: string;
	readonly file: string;
}

function packageName(specifier: string): string {
	return specifier
		.split("/")
		.slice(0, specifier.startsWith("@") ? 2 : 1)
		.join("/");
}

function declarationTarget(target: string): string {
	return posix.normalize(target.endsWith(".d.ts") ? target : target.replace(/\.(?:js|tsx?)$/u, ".d.ts"));
}

function referenceTarget(manifest: Manifest, file: string, specifier: string): { readonly file: string } | { readonly dependency: string } {
	if (specifier.startsWith(".")) {
		return { file: declarationTarget(posix.join(posix.dirname(file), specifier)) };
	}
	let entry: unknown;
	if (specifier.startsWith("#")) {
		entry = importEntry(manifest.imports ?? {}, specifier);
	} else if (specifier.startsWith(`${manifest.name}/`)) {
		entry = importEntry(manifest.exports ?? {}, `.${specifier.slice(manifest.name.length)}`);
	}
	const target = conditionalTarget(entry, ["types"]);
	if (target?.startsWith(".")) {
		return { file: declarationTarget(target) };
	}
	return { dependency: packageName(target ?? specifier) };
}

function developmentPackages(manifest: Manifest): ReadonlySet<string> {
	const runtime = new Set(Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies }));
	const names = Object.keys(manifest.devDependencies ?? {});
	const types = names
		.filter((name) => name.startsWith("@types/"))
		.map((name) => {
			const module = name.slice(7);
			return module.includes("__") ? `@${module.replace("__", "/")}` : module;
		});
	return new Set([...names, ...types].filter((name) => !runtime.has(name)));
}

function outsidePackage(dependency: string, name: string, development: ReadonlySet<string>): boolean {
	return (
		dependency !== ""
		&& dependency !== name
		&& !dependency.startsWith("#")
		&& !isBuiltin(dependency)
		&& !development.has(dependency)
		&& !effectPackage(dependency)
		&& !dependency.startsWith("@shivaedev/")
	);
}

export function vendorTypes(manifest: Manifest, sources: ReadonlyMap<string, string>): VendorType[] {
	const development = developmentPackages(manifest);
	const pending = [...exportTargets(manifest, new Set(sources.keys())), manifest.types ?? ""]
		.map(declarationTarget)
		.filter((file) => file.endsWith(".d.ts"));
	const visited = new Set<string>();
	const findings: VendorType[] = [];
	for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
		const file = posix.normalize(next);
		if (visited.has(file)) {
			continue;
		}
		visited.add(file);
		const source = sources.get(file);
		if (source === undefined) {
			continue;
		}
		const imports = ts.preProcessFile(source).importedFiles;
		for (const { fileName: specifier } of imports) {
			const target = referenceTarget(manifest, file, specifier);
			if ("file" in target) {
				pending.push(target.file);
				continue;
			}
			const { dependency } = target;
			if (
				!file.split("/").includes("adapters")
				&& outsidePackage(dependency, manifest.name, development)
				&& !findings.some((finding) => finding.file === file && finding.dependency === dependency)
			) {
				findings.push({ dependency, file });
			}
		}
	}
	return findings.toSorted((left, right) => left.file.localeCompare(right.file) || left.dependency.localeCompare(right.dependency));
}
