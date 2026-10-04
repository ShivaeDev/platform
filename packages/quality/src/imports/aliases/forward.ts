import { posix } from "node:path";
import { branches, captured, type Entries, exportEntries, field, filled, importEntries, LOCAL, wildcards } from "./pattern.ts";

export interface Located {
	readonly directory: string;
	readonly manifest: unknown;
}

interface Match {
	readonly capture: string;
	readonly key: string;
	readonly value: unknown;
}

const IMPORT_PREFIX = "#";

function prefixLength(key: string): number {
	return key.indexOf("*");
}

// Node picks an exact key without a wildcard, else the pattern with the longest prefix, then the longest key; a pattern captures something.
function matching(entries: Entries, request: string): Match | undefined {
	const exact = entries.find(([key]) => key === request && wildcards(key) === 0);
	if (exact !== undefined) {
		return { capture: "", key: exact[0], value: exact[1] };
	}
	const patterns = entries.flatMap(([key, value]) => {
		const capture = wildcards(key) === 1 ? captured(key, request) : undefined;
		return capture === undefined || capture === "" ? [] : [{ capture, key, value }];
	});
	return patterns.sort((left, right) => prefixLength(right.key) - prefixLength(left.key) || right.key.length - left.key.length)[0];
}

function landsLocally(directory: string, target: string, capture: string, file: string): boolean {
	return target.startsWith(LOCAL) && posix.join(directory, filled(target, capture)) === file;
}

function packageLands(owner: Located | undefined, specifier: string, file: string): boolean {
	const name = field(owner?.manifest, "name");
	if (owner === undefined || typeof name !== "string" || !(specifier === name || specifier.startsWith(`${name}/`))) {
		return false;
	}
	const match = matching(exportEntries(owner.manifest), `.${specifier.slice(name.length)}`);
	return (
		match !== undefined && branches(match.value).every((branch) => branch !== undefined && landsLocally(owner.directory, branch, match.capture, file))
	);
}

// Every condition a runtime, bundler or type checker may pick must load the file, so no environment gets another module.
export function loadsOnly(own: Located | undefined, owner: Located | undefined, specifier: string, file: string): boolean {
	if (!specifier.startsWith(IMPORT_PREFIX)) {
		return packageLands(owner, specifier, file);
	}
	const match = own === undefined ? undefined : matching(importEntries(own.manifest), specifier);
	if (own === undefined || match === undefined) {
		return false;
	}
	return branches(match.value).every(
		(branch) =>
			branch !== undefined
			&& (branch.startsWith(LOCAL)
				? landsLocally(own.directory, branch, match.capture, file)
				: packageLands(owner, filled(branch, match.capture), file)),
	);
}
