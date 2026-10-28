import { posix } from "node:path";
import { Schema } from "effect";
import { exportedModule, exportTargets } from "#imports/packageExports.ts";
import { packageOf, workspacePackages } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";
import { KNIP_ISSUES } from "./findings.ts";

const Manifest = Schema.Struct({
	bin: Schema.optional(Schema.Unknown),
	exports: Schema.optional(Schema.Unknown),
	scripts: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

const ENTRIES = ["**/*.{test,spec,stories,story}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}", "src/test-support/**", "*.config.{ts,mts,cts,js,mjs,cjs}"];

export async function knipConfiguration(inputs: RuleInputs) {
	const packages = await workspacePackages(inputs);
	const workspaces = await Promise.all(
		[".", ...packages.map(({ directory }) => directory)].map(async (directory) => {
			const text = await inputs.readText(posix.join(directory, "package.json"));
			const manifest = Schema.decodeUnknownSync(Schema.fromJsonString(Manifest))(text ?? "{}");
			const sources = inputs.sources
				.filter(({ path }) => (packageOf(packages, path)?.directory ?? ".") === directory)
				.map(({ path }) => posix.relative(directory, path));
			const scriptWords = new Set(Object.values(manifest.scripts ?? {}).flatMap((script) => script.split(/[\s'"`;|&()]+/u)));
			const scripted = sources.filter((path) => scriptWords.has(path) || scriptWords.has(`./${path}`));
			const bins = exportTargets(manifest.bin).map((target) => target.replace(/^\.\//u, ""));
			const binaries = sources.filter(
				(path) => bins.includes(path) || bins.includes(path.replace(/^src\//u, "dist/").replace(/\.(?<mode>[cm]?)tsx?$/u, ".$<mode>js")),
			);
			const publicFiles = sources.filter((path) => exportedModule(manifest.exports, path));
			return [directory, { entry: [...ENTRIES, ...publicFiles, ...bins, ...binaries, ...scripted], project: sources }] as const;
		}),
	);
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
