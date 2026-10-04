import { posix } from "node:path";

export interface Mapping {
	readonly from: string;
	readonly to: string | undefined;
}

const WILDCARD = "*";

const LOCAL = "./";

function wildcards(pattern: string): number {
	return pattern.split(WILDCARD).length - 1;
}

// A mapping without a known target, such as a package without exports, matches every file: resolution decides.
export function captured(pattern: string | undefined, value: string): string | undefined {
	if (pattern === undefined) {
		return "";
	}
	const [head = "", tail] = pattern.split(WILDCARD);
	if (tail === undefined) {
		return pattern === value ? "" : undefined;
	}
	const fits = value.length >= head.length + tail.length && value.startsWith(head) && value.endsWith(tail);
	return fits ? value.slice(head.length, value.length - tail.length) : undefined;
}

export function filled(pattern: string, capture: string): string {
	const [head = "", tail] = pattern.split(WILDCARD);
	return tail === undefined ? pattern : `${head}${capture}${tail}`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function field(value: unknown, key: string): unknown {
	return isRecord(value) ? value[key] : undefined;
}

// Every condition counts: resolving the alias afterwards decides whether it reaches the same file.
function targetsOf(value: unknown): readonly string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (Array.isArray(value)) {
		return value.flatMap(targetsOf);
	}
	return isRecord(value) ? Object.values(value).flatMap(targetsOf) : [];
}

function mappingsOf(entries: readonly (readonly [string, unknown])[], directory: string, local: boolean): readonly Mapping[] {
	return entries.flatMap(([from, value]) =>
		targetsOf(value).flatMap((target) => {
			const to = target.startsWith(LOCAL) ? posix.join(directory, target) : target;
			const usable = wildcards(from) === wildcards(to) && wildcards(from) <= 1 && (local ? target.startsWith(LOCAL) : true);
			return usable ? [{ from, to }] : [];
		}),
	);
}

export function importMappings(manifest: unknown, directory: string): readonly Mapping[] {
	const imports = field(manifest, "imports");
	return isRecord(imports) ? mappingsOf(Object.entries(imports), directory, false) : [];
}

function subpaths(exports: unknown): readonly (readonly [string, unknown])[] {
	if (isRecord(exports) && Object.keys(exports).every((key) => key.startsWith("."))) {
		return Object.entries(exports);
	}
	return exports === undefined || exports === null ? [] : [[".", exports]];
}

export function exportMappings(manifest: unknown, directory: string): readonly Mapping[] {
	const name = field(manifest, "name");
	if (typeof name !== "string") {
		return [];
	}
	const exports = field(manifest, "exports");
	if (exports === undefined) {
		return [{ from: name, to: undefined }];
	}
	return mappingsOf(subpaths(exports), directory, true).map(({ from, to }) => ({ from: `${name}${from.slice(1)}`, to }));
}

export function pathMappings(paths: Readonly<Record<string, readonly string[]>> | undefined, base: string): readonly Mapping[] {
	return Object.entries(paths ?? {}).flatMap(([from, substitutions]) =>
		substitutions.flatMap((substitution) => {
			const to = posix.join(base, substitution);
			return wildcards(from) === wildcards(to) && wildcards(from) <= 1 ? [{ from, to }] : [];
		}),
	);
}
