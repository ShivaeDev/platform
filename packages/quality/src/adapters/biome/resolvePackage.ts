import { posix } from "node:path";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import type { PackageManifest } from "#PackageManifest.ts";
import type { RuleInputs } from "#rule.ts";

const CONDITIONS: ReadonlySet<string> = new Set(["biome", "default"]);

const SPECIFIER = /^(?<name>(?:@[^/]+\/)?[^/]+)(?:\/(?<subpath>.+))?$/u;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function targetOf(value: unknown, star: string | undefined): string | undefined {
	if (typeof value === "string") {
		return star === undefined ? value : value.replaceAll("*", star);
	}
	if (Array.isArray(value)) {
		return value.map((item: unknown) => targetOf(item, star)).find((target) => target !== undefined);
	}
	const condition = isRecord(value) ? Object.keys(value).find((key) => CONDITIONS.has(key)) : undefined;
	return isRecord(value) && condition !== undefined ? targetOf(value[condition], star) : undefined;
}

function bySpecificity(left: string, right: string): number {
	return right.indexOf("*") - left.indexOf("*") || right.length - left.length;
}

function patternTarget(exports: Readonly<Record<string, unknown>>, key: string): string | undefined {
	const pattern = Object.keys(exports)
		.filter((candidate) => candidate.split("*").length === 2)
		.sort(bySpecificity)
		.find((candidate) => {
			const [prefix = "", suffix = ""] = candidate.split("*");
			return key.startsWith(prefix) && key !== prefix && key.endsWith(suffix) && key.length >= candidate.length;
		});
	const [prefix = "", suffix = ""] = pattern?.split("*") ?? [];
	return pattern === undefined ? undefined : targetOf(exports[pattern], key.slice(prefix.length, key.length - suffix.length));
}

function exported(exports: unknown, subpath: string): string | undefined {
	const key = subpath === "" ? "." : `./${subpath}`;
	if (!isRecord(exports)) {
		return targetOf(exports, undefined);
	}
	return Object.hasOwn(exports, key) ? targetOf(exports[key], undefined) : (patternTarget(exports, key) ?? targetOf(exports, undefined));
}

function inPackage(directory: string, target: string | undefined): string | undefined {
	return target?.startsWith("./") === true ? posix.join(directory, target) : undefined;
}

function fromDependency(directory: string, manifest: PackageManifest, subpath: string): string | undefined {
	if (manifest.exports !== undefined) {
		return inPackage(directory, exported(manifest.exports, subpath));
	}
	if (subpath === "" && manifest.main !== undefined) {
		return posix.join(directory, manifest.main);
	}
	return subpath === "" ? undefined : posix.join(directory, subpath);
}

export async function resolvePackage(readText: RuleInputs["readText"], specifier: string): Promise<string | undefined> {
	const { name, subpath = "" } = SPECIFIER.exec(specifier)?.groups ?? {};
	if (name === undefined) {
		return undefined;
	}
	const own = await readPackageManifest(readText, "package.json");
	if (own?.name === name && own.exports !== undefined && subpath !== "") {
		return inPackage("", exported(own.exports, subpath));
	}
	const directory = posix.join("node_modules", name);
	const manifest = await readPackageManifest(readText, posix.join(directory, "package.json"));
	return manifest === undefined ? undefined : fromDependency(directory, manifest, subpath);
}
