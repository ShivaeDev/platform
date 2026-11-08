import { posix } from "node:path";
import { Effect } from "effect";
import { type ManifestReadFailure, readPackageManifest } from "#adapters/manifestInventory.ts";
import type { RuleInputs } from "#rule.ts";

export type PackageImports = (importer: string, specifier: string) => string | undefined;

const MANIFEST = "package.json";

function targetsIn(value: unknown): readonly string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (Array.isArray(value)) {
		return value.flatMap(targetsIn);
	}
	return typeof value === "object" && value !== null ? Object.values(value).flatMap(targetsIn) : [];
}

function matched(imports: unknown, specifier: string): readonly string[] {
	if (typeof imports !== "object" || imports === null) {
		return [];
	}
	const entries = Object.entries(imports);
	const exact = entries.find(([key]) => key === specifier);
	if (exact !== undefined) {
		return targetsIn(exact[1]);
	}
	const patterns = entries.flatMap(([key, value]) => {
		const [prefix = "", suffix, ...rest] = key.split("*");
		const fits = suffix !== undefined && rest.length === 0 && specifier.length >= prefix.length + suffix.length;
		return fits && specifier.startsWith(prefix) && specifier.endsWith(suffix) ? [{ prefix, suffix, value }] : [];
	});
	const [best] = patterns.toSorted((left, right) => right.prefix.length - left.prefix.length);
	if (best === undefined) {
		return [];
	}
	const star = specifier.slice(best.prefix.length, specifier.length - best.suffix.length);
	return targetsIn(best.value).map((target) => target.replaceAll("*", star));
}

export const packageImports = Effect.fn("Files.packageImports")(function* ({
	files,
	readText,
}: Pick<RuleInputs, "files" | "readText">): Effect.fn.Return<PackageImports, ManifestReadFailure> {
	const directories = files.filter((path) => posix.basename(path) === MANIFEST).map((path) => posix.dirname(path));
	const manifests = yield* Effect.forEach(
		directories,
		(directory) =>
			Effect.map(readPackageManifest(readText, posix.join(directory, MANIFEST)), (manifest) => ({ directory, imports: manifest?.imports })),
		{ concurrency: "unbounded" },
	);
	const deepestFirst = manifests.toSorted((left, right) => right.directory.length - left.directory.length);
	const present = new Set(files);
	return (importer, specifier) => {
		const owner = deepestFirst.find(({ directory }) => directory === "." || importer.startsWith(`${directory}/`));
		if (owner === undefined) {
			return undefined;
		}
		return matched(owner.imports, specifier)
			.map((target) => posix.normalize(posix.join(owner.directory, target)))
			.find((path) => present.has(path));
	};
});
