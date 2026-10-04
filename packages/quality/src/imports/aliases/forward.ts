import { posix } from "node:path";
import type { Emitted } from "./emitted.ts";
import { branches, captured, covered, type Entries, exportEntries, field, filled, importEntries, LOCAL, mainEntry, wildcards } from "./pattern.ts";

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

const BUNDLER_FIELDS = ["module", "browser"];

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

function landsLocally(emitted: Emitted, located: Located, target: string, capture: string, file: string): boolean {
	return target.startsWith(LOCAL) && emitted(located.directory, file).has(posix.join(located.directory, filled(target, capture)));
}

function everyBranchLands(value: unknown, lands: (branch: string) => boolean): boolean {
	return covered(value) && branches(value).every((branch) => branch !== undefined && lands(branch));
}

function mainLands(emitted: Emitted, owner: Located, main: string, file: string): boolean {
	const modules = emitted(owner.directory, file);
	const entries = [main, ...BUNDLER_FIELDS.map((name) => field(owner.manifest, name)).filter((entry) => entry !== undefined)];
	return entries.every((entry) => typeof entry === "string" && modules.has(posix.join(owner.directory, entry)));
}

function packageLands(emitted: Emitted, owner: Located | undefined, specifier: string, file: string): boolean {
	const name = field(owner?.manifest, "name");
	if (owner === undefined || typeof name !== "string" || !(specifier === name || specifier.startsWith(`${name}/`))) {
		return false;
	}
	const main = mainEntry(owner.manifest);
	if (main !== undefined) {
		return specifier === name && mainLands(emitted, owner, main, file);
	}
	const match = matching(exportEntries(owner.manifest), `.${specifier.slice(name.length)}`);
	return match !== undefined && everyBranchLands(match.value, (branch) => landsLocally(emitted, owner, branch, match.capture, file));
}

// Every environment must reach a branch, and every branch must load the file or its build output, so no environment gets another module.
export function loadsOnly(emitted: Emitted, own: Located | undefined, owner: Located | undefined, specifier: string, file: string): boolean {
	if (!specifier.startsWith(IMPORT_PREFIX)) {
		return packageLands(emitted, owner, specifier, file);
	}
	const match = own === undefined ? undefined : matching(importEntries(own.manifest), specifier);
	if (own === undefined || match === undefined) {
		return false;
	}
	return everyBranchLands(match.value, (branch) =>
		branch.startsWith(LOCAL)
			? landsLocally(emitted, own, branch, match.capture, file)
			: packageLands(emitted, owner, filled(branch, match.capture), file),
	);
}
