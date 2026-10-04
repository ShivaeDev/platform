import { posix } from "node:path";

export interface Mapping {
	readonly from: string;
	readonly to: string;
}

export type Entries = readonly (readonly [string, unknown])[];

const WILDCARD = "*";

export const LOCAL = "./";

export function wildcards(pattern: string): number {
	return pattern.split(WILDCARD).length - 1;
}

export function captured(pattern: string, value: string): string | undefined {
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

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function field(value: unknown, key: string): unknown {
	return isRecord(value) ? value[key] : undefined;
}

// A blocked condition (null) loads nothing, so it stays in the list as undefined.
export function branches(value: unknown): readonly (string | undefined)[] {
	if (typeof value === "string") {
		return [value];
	}
	if (Array.isArray(value)) {
		return value.flatMap(branches);
	}
	return isRecord(value) ? Object.values(value).flatMap(branches) : [undefined];
}

function mappingsOf(entries: Entries, directory: string, local: boolean): readonly Mapping[] {
	return entries.flatMap(([from, value]) =>
		branches(value).flatMap((target) => {
			if (target === undefined || (local && !target.startsWith(LOCAL))) {
				return [];
			}
			const to = target.startsWith(LOCAL) ? posix.join(directory, target) : target;
			return wildcards(from) === wildcards(to) && wildcards(from) <= 1 ? [{ from, to }] : [];
		}),
	);
}

export function importEntries(manifest: unknown): Entries {
	const imports = field(manifest, "imports");
	return isRecord(imports) ? Object.entries(imports) : [];
}

export function exportEntries(manifest: unknown): Entries {
	const exports = field(manifest, "exports");
	if (isRecord(exports) && Object.keys(exports).every((key) => key.startsWith("."))) {
		return Object.entries(exports);
	}
	return exports === undefined || exports === null ? [] : [[".", exports]];
}

export function importMappings(manifest: unknown, directory: string): readonly Mapping[] {
	return mappingsOf(importEntries(manifest), directory, false);
}

export function exportMappings(manifest: unknown, directory: string): readonly Mapping[] {
	const name = field(manifest, "name");
	return typeof name === "string"
		? mappingsOf(exportEntries(manifest), directory, true).map(({ from, to }) => ({ from: `${name}${from.slice(1)}`, to }))
		: [];
}
