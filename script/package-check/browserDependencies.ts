import { dependencyKeys, type Package } from "#package-check/model.ts";

export type Entries = Readonly<Record<string, readonly string[]>>;

export function browserEntries(entries: Entries, pkg: Package): readonly string[] {
	return entries[pkg.directory.split("/").at(-1) ?? ""] ?? [];
}

export function dependencyEntry(owner: Package, packages: readonly Package[], entries: Entries, specifier: string): Package | undefined {
	const dependency = packages.find(({ manifest }) => specifier.startsWith(`${manifest.name}/`));
	if (
		dependency === undefined
		|| !dependencyKeys.some((key) => key !== "devDependencies" && dependency.manifest.name in (owner.manifest[key] ?? {}))
	) {
		return undefined;
	}
	return browserEntries(entries, dependency).includes(`.${specifier.slice(dependency.manifest.name.length)}`) ? dependency : undefined;
}
