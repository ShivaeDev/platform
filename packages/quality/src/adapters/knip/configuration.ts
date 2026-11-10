import { globSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { Effect } from "effect";
import { isToolConfig } from "#adapters/isToolConfig.ts";
import { KNIP_ISSUES } from "#adapters/knip/findings.ts";
import { mockEntries } from "#adapters/knip/mockEntries.ts";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import type { ReachableBuilds } from "#adapters/reachableBuilds.ts";
import { scriptPaths } from "#adapters/scriptPaths.ts";
import { exportedModule, exportTargets } from "#imports/packageExports.ts";
import { packageOf, workspacePackages } from "#imports/workspace.ts";
import { deliveredDependencies } from "#manifests/deliveredDependencies.ts";
import type { PackageManifest } from "#PackageManifest.ts";
import type { RuleInputs } from "#rule.ts";

const ENTRIES = ["**/*.{test,spec,stories,story}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}", "src/test-support/**", "*.config.{ts,mts,cts,js,mjs,cjs}"];

export function declaredEntries(inputs: RuleInputs): readonly string[] {
	return (inputs.entries ?? []).flatMap((pattern) => {
		const matches = globSync(pattern, { cwd: inputs.root }).filter((path) => statSync(join(inputs.root, path)).isFile());
		if (matches.length === 0) {
			throw new Error(`quality.config.ts entries pattern "${pattern}" matched no files`);
		}
		return matches;
	});
}

function importPaths(imports: Readonly<Record<string, unknown>>) {
	return Object.fromEntries(
		Object.entries(imports).flatMap(([name, target]) => {
			let selected = target;
			if (typeof target === "object" && target !== null) {
				if ("@shivaedev/source" in target) {
					selected = target["@shivaedev/source"];
				} else if ("source" in target) {
					selected = target.source;
				}
			}
			const paths = exportTargets(selected).filter((path) => path.startsWith("./"));
			return paths.length === 0 ? [] : [[name, paths]];
		}),
	);
}

function externalDependencies(manifest: PackageManifest, externals: ReadonlySet<string>): readonly string[] {
	const dependencies = [manifest.dependencies, manifest.devDependencies, manifest.optionalDependencies, manifest.peerDependencies].flatMap((names) =>
		Object.keys(names ?? {}),
	);
	return dependencies.filter((name) => externals.has(name));
}

export const knipConfiguration = Effect.fn("Knip.knipConfiguration")(function* (
	inputs: RuleInputs,
	unchecked: readonly string[] = [],
	builds: ReachableBuilds = { entries: new Set(), externals: new Map() },
	declared: readonly string[] = declaredEntries(inputs),
) {
	const packages = yield* workspacePackages(inputs);
	const manifests = yield* Effect.forEach(
		[".", ...packages.map(({ directory }) => directory)],
		(directory) =>
			Effect.map(readPackageManifest(inputs.readText, posix.join(directory, "package.json")), (manifest) => ({
				directory,
				manifest: manifest ?? {},
			})),
		{ concurrency: "unbounded" },
	);
	const scripted = new Set(manifests.flatMap(({ directory, manifest }) => scriptPaths(directory, manifest.scripts ?? {})));
	const mocked = new Set(mockEntries(inputs));
	const workspaces = manifests.map(({ directory, manifest }) => {
		const sources = inputs.sources
			.filter(({ path }) => (packageOf(packages, path)?.directory ?? ".") === directory)
			.map(({ path }) => posix.relative(directory, path));
		const scriptEntries = sources.filter((path) => scripted.has(posix.join(directory, path)));
		const bundled = sources.filter((path) => builds.entries.has(posix.join(directory, path)) || mocked.has(posix.join(directory, path)));
		const bins = exportTargets(manifest.bin).map((target) => target.replace(/^\.\//u, ""));
		const binaries = sources.filter(
			(path) => bins.includes(path) || bins.includes(path.replace(/^src\//u, "dist/").replace(/\.(?<mode>[cm]?)tsx?$/u, ".$<mode>js")),
		);
		const publicFiles = sources.filter((path) => exportedModule(manifest.exports, path));
		const configs = sources.filter(isToolConfig);
		// Migration runners load these files from their directory, so no import reaches them.
		const migrations = sources.filter((path) => /(?:^|\/)server\/migrations\//u.test(path));
		// Tool-owned and git-ignored files are never reported, but their imports count as uses.
		const followed = unchecked
			.filter((file) => (packageOf(packages, file)?.directory ?? ".") === directory)
			.map((file) => posix.relative(directory, file));
		const workspaceEntries = declared
			.filter((file) => (packageOf(packages, file)?.directory ?? ".") === directory)
			.map((file) => posix.relative(directory, file));
		const styles = inputs.files
			.filter((path) => path.endsWith(".css") && (packageOf(packages, path)?.directory ?? ".") === directory)
			.map((path) => posix.relative(directory, path));
		return [
			directory,
			{
				entry: [
					...ENTRIES,
					...publicFiles,
					...configs,
					...migrations,
					...bins,
					...binaries,
					...scriptEntries,
					...bundled,
					...followed,
					...styles,
					...workspaceEntries,
				],
				// A bundle leaves its externals as runtime imports, which the bundling package's own dependencies satisfy.
				ignoreDependencies: [
					...externalDependencies(manifest, builds.externals.get(directory === "." ? "" : directory) ?? new Set()),
					...deliveredDependencies(manifest, sources),
				],
				paths: importPaths(manifest.imports ?? {}),
				project: [...sources, ...followed, ...styles, ...workspaceEntries],
				vitest: { config: ["vitest*.config.{ts,mts,cts,js,mjs,cjs}", "vitest.{workspace,projects}.{ts,mts,cts,js,mjs,cjs,json}"] },
			},
		] as const;
	});
	return {
		exclude: [],
		ignore: [],
		ignoreBinaries: [],
		ignoreDependencies: [],
		ignoreExportsUsedInFile: false,
		ignoreFiles: [],
		ignoreIssues: {},
		ignoreMembers: [],
		ignoreUnresolved: [],
		ignoreWorkspaces: [],
		include: KNIP_ISSUES,
		includeEntryExports: false,
		rules: Object.fromEntries(KNIP_ISSUES.map((kind) => [kind, "error"])),
		tags: [],
		workspaces: Object.fromEntries(workspaces),
	};
});
