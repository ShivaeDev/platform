import { Effect } from "effect";
import { requireThat } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

export const consumerDependencies = (pkg: Package, packages: readonly Package[], imports: ReadonlySet<string>, omitOptionalPeers = false) =>
	Effect.gen(function* () {
		const closure = workspaceClosure(pkg, packages, imports, omitOptionalPeers);
		const dependencies: Record<string, string> = {
			effect: "catalog:",
			"@types/node": "catalog:",
			"@typescript/native": "catalog:",
		};
		for (const entry of closure.values()) {
			Object.assign(dependencies, peers(entry, omitOptionalPeers));
			Object.assign(dependencies, fixtureDependencies(entry, imports));
		}
		const tarballs = Object.fromEntries([...closure.values()].map((entry) => [entry.manifest.name, entry.tarball]));
		for (const [name, tarball] of Object.entries(tarballs)) dependencies[name] = `file:${tarball}`;
		for (const name of imports)
			yield* requireThat(
				name in dependencies || name in (pkg.manifest.dependencies ?? {}) || name.startsWith("node:"),
				`${pkg.manifest.name}: fixture import ${name} is not declared`,
			);
		return { dependencies, tarballs };
	});

const workspaceClosure = (pkg: Package, packages: readonly Package[], imports: ReadonlySet<string>, omitOptionalPeers: boolean) => {
	const closure = new Map<string, Package>();
	const visit = (entry: Package): void => {
		if (closure.has(entry.manifest.name)) return;
		closure.set(entry.manifest.name, entry);
		for (const dependency of packages) {
			const edges = { ...entry.manifest.dependencies, ...peers(entry, omitOptionalPeers), ...entry.manifest.optionalDependencies };
			if (edges[dependency.manifest.name] === "workspace:*" || imports.has(dependency.manifest.name)) visit(dependency);
		}
	};
	visit(pkg);
	return closure;
};

const fixtureDependencies = (entry: Package, imports: ReadonlySet<string>): Record<string, string> =>
	Object.fromEntries(
		Object.entries({ ...entry.manifest.dependencies, ...entry.manifest.devDependencies })
			.filter(([name]) => name.startsWith("@types/") || imports.has(name))
			.map(([name, version]) => [name, version]),
	);

const peers = (pkg: Package, omitOptionalPeers: boolean) =>
	Object.fromEntries(
		Object.entries(pkg.manifest.peerDependencies ?? {}).filter(
			([name]) => !omitOptionalPeers || pkg.manifest.peerDependenciesMeta?.[name]?.optional !== true,
		),
	);
