import { posix } from "node:path";
import { Effect } from "effect";
import { command } from "#package-check/io.ts";
import { bins, type Manifest, type Package, targets } from "#package-check/model.ts";

export interface Entry {
	readonly json: boolean;
	readonly specifier: string;
}

function starOf(pattern: string, path: string): string | undefined {
	const [prefix = "", suffix = ""] = posix.normalize(pattern).split("*");
	return path.length > prefix.length + suffix.length && path.startsWith(prefix) && path.endsWith(suffix)
		? path.slice(prefix.length, path.length - suffix.length)
		: undefined;
}

function sourceTargets(value: unknown): string[] {
	return typeof value === "object" && value !== null && "source" in value ? targets(value.source) : targets(value);
}

// The source target enumerates a pattern's modules, so every packed source module must also ship its dist targets. Executables stay out: importing one runs it.
function stars(manifest: Manifest, value: unknown, packed: ReadonlySet<string>): string[] {
	const executables = new Set(Object.values(bins(manifest)).map((bin) => posix.normalize(bin)));
	const found = new Set(sourceTargets(value).flatMap((target) => [...packed].flatMap((path) => starOf(target, path) ?? [])));
	return [...found]
		.filter((star) => !targets(value).some((target) => executables.has(posix.normalize(target.replaceAll("*", star)))))
		.toSorted((left, right) => left.localeCompare(right));
}

export function exportTargets(manifest: Manifest, packed: ReadonlySet<string>): string[] {
	return Object.entries(manifest.exports ?? {}).flatMap(([key, value]) =>
		key.includes("*")
			? stars(manifest, value, packed).flatMap((star) => targets(value).map((target) => target.replaceAll("*", star)))
			: targets(value),
	);
}

export function exportEntries(manifest: Manifest, packed: ReadonlySet<string>): Entry[] {
	return Object.entries(manifest.exports ?? {})
		.filter(([, value]) => value !== null)
		.flatMap(([key, value]) => {
			const json = targets(value).some((target) => target.endsWith(".json"));
			const subpaths = key.includes("*") ? stars(manifest, value, packed).map((star) => key.replace("*", star)) : [key];
			return subpaths.map((subpath) => ({ json, specifier: subpath === "." ? manifest.name : `${manifest.name}${subpath.slice(1)}` }));
		});
}

export function packedFiles(pkg: Package) {
	return Effect.map(
		command(pkg.directory, "tar", ["-tzf", pkg.tarball]),
		(listing) =>
			new Set(
				listing
					.trim()
					.split("\n")
					.map((path) => posix.relative("package", path)),
			),
	);
}
