import { posix } from "node:path";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { exportedModule, exportTargets } from "#imports/packageExports.ts";
import { packageOf, workspacePackages } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";
import { KNIP_ISSUES } from "./findings.ts";

const ENTRIES = ["**/*.{test,spec,stories,story}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}", "src/test-support/**", "*.config.{ts,mts,cts,js,mjs,cjs}"];

function importPaths(imports: Readonly<Record<string, unknown>>) {
	return Object.fromEntries(
		Object.entries(imports).flatMap(([name, target]) => {
			const selected = typeof target === "object" && target !== null && "source" in target ? target.source : target;
			const paths = exportTargets(selected).filter((path) => path.startsWith("./"));
			return paths.length === 0 ? [] : [[name, paths]];
		}),
	);
}

export async function knipConfiguration(inputs: RuleInputs, toolOwned: readonly string[] = []) {
	const packages = await workspacePackages(inputs);
	const manifests = await Promise.all(
		[".", ...packages.map(({ directory }) => directory)].map(async (directory) => {
			const manifest = (await readPackageManifest(inputs.readText, posix.join(directory, "package.json"))) ?? {};
			return { directory, manifest };
		}),
	);
	const scripted = new Set(
		manifests.flatMap(({ directory, manifest }) =>
			Object.values(manifest.scripts ?? {}).flatMap((script) => script.split(/[\s'"`;|&()]+/u).map((word) => posix.join(directory, word))),
		),
	);
	const workspaces = manifests.map(({ directory, manifest }) => {
		const sources = inputs.sources
			.filter(({ path }) => (packageOf(packages, path)?.directory ?? ".") === directory)
			.map(({ path }) => posix.relative(directory, path));
		const scriptEntries = sources.filter((path) => scripted.has(posix.join(directory, path)));
		const bins = exportTargets(manifest.bin).map((target) => target.replace(/^\.\//u, ""));
		const binaries = sources.filter(
			(path) => bins.includes(path) || bins.includes(path.replace(/^src\//u, "dist/").replace(/\.(?<mode>[cm]?)tsx?$/u, ".$<mode>js")),
		);
		const publicFiles = sources.filter((path) => exportedModule(manifest.exports, path));
		// Migration runners load these files from their directory, so no import reaches them.
		const migrations = sources.filter((path) => /(?:^|\/)server\/migrations\//u.test(path));
		const ui = toolOwned
			.filter((folder) => (packageOf(packages, `${folder}/component.ts`)?.directory ?? ".") === directory)
			.map((folder) => `${posix.relative(directory, folder)}/**/*.{ts,tsx,js,jsx}`);
		const styles = inputs.files
			.filter((path) => path.endsWith(".css") && (packageOf(packages, path)?.directory ?? ".") === directory)
			.map((path) => posix.relative(directory, path));
		return [
			directory,
			{
				entry: [...ENTRIES, ...publicFiles, ...migrations, ...bins, ...binaries, ...scriptEntries, ...ui, ...styles],
				paths: importPaths(manifest.imports ?? {}),
				project: [...sources, ...ui, ...styles],
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
}
