export function frameworkDependencies(declared: Readonly<Record<string, string>>, pinned: Readonly<Record<string, string>>, cataloged: boolean) {
	return Object.fromEntries(
		Object.entries(pinned).map(
			([name, version]) => [name, cataloged && declared[name]?.startsWith("workspace:") ? "catalog:framework" : version] as const,
		),
	);
}

export function frameworkCatalog(source: string, versions: Readonly<Record<string, string>>) {
	const entries = Object.entries(versions)
		.map(([name, version]) => `    ${JSON.stringify(name)}: ${JSON.stringify(version)}\n`)
		.join("");
	const block = `  framework:\n${entries}`;
	const heading = /^(?<quote>["']?)catalogs\k<quote>:[ \t]*(?:#.*)?$/mu;
	return heading.test(source) ? source.replace(heading, (line) => `${line}\n${block.trimEnd()}`) : `${source.trimEnd()}\n\ncatalogs:\n${block}`;
}
