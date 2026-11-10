import { Effect, Option, Path } from "effect";
import { packageScopeOf } from "#packageScope.ts";

function targetsOf(value: unknown): readonly string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (Array.isArray(value)) {
		return value.flatMap(targetsOf);
	}
	return typeof value === "object" && value !== null ? Object.values(value).flatMap(targetsOf) : [];
}

function exportEntries(exports: unknown): readonly (readonly [string, unknown])[] {
	if (typeof exports !== "object" || exports === null || Array.isArray(exports)) {
		return exports === undefined ? [] : [[".", exports]];
	}
	const entries = Object.entries(exports);
	return entries.every(([key]) => key.startsWith(".")) ? entries : [[".", exports]];
}

// The key of the first entry whose target names the file, with its wildcard filled in.
export function matchingKey(entries: readonly (readonly [string, unknown])[], relativeFile: string): string | undefined {
	for (const [key, value] of entries) {
		for (const target of targetsOf(value)) {
			const [prefix = "", suffix, ...rest] = target.split("*");
			if (suffix === undefined && target === relativeFile) {
				return key;
			}
			const fits = suffix !== undefined && rest.length === 0 && relativeFile.length >= prefix.length + suffix.length;
			if (fits && relativeFile.startsWith(prefix) && relativeFile.endsWith(suffix)) {
				return key.replace("*", relativeFile.slice(prefix.length, relativeFile.length - suffix.length));
			}
		}
	}
	return undefined;
}

// How the generated file at `from` imports `file`: the project's own imports, another package's exports, else a relative path.
export const specifierFor = Effect.fn("Build.specifierFor")(function* (root: string, from: string, file: string) {
	const path = yield* Path.Path;
	const scope = yield* packageScopeOf(file);
	if (Option.isNone(scope)) {
		return undefined;
	}
	const { directory, manifest } = scope.value;
	const relativeFile = `./${path.relative(directory, file)}`;
	if (directory === root) {
		const own = matchingKey(Object.entries(manifest.imports ?? {}), relativeFile);
		const relative = path.relative(path.dirname(from), file);
		return own ?? (relative.startsWith(".") ? relative : `./${relative}`);
	}
	const exported = matchingKey(exportEntries(manifest.exports), relativeFile);
	return exported === undefined || manifest.name === undefined ? undefined : `${manifest.name}${exported.slice(1)}`;
});
