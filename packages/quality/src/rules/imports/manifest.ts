import { posix } from "node:path";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { type ImportGraph, importGraph } from "#imports/graph.ts";
import { isTooling } from "#imports/isTooling.ts";
import { builtinName } from "#imports/packageName.ts";
import { packageOf, type WorkspacePackage } from "#imports/workspace.ts";
import { dependencyNames, type EntryPoint, entryPointsOf, isApplication, provider, SHIPPED_FIELDS } from "#manifests/entryPoints.ts";
import { isTestCode } from "#naming/testName.ts";
import { defineRule, type RuleInputs } from "#rule.ts";
import { bundleInputs } from "./bundleInputs.ts";

const QUERY = /\?.*$/u;

function packageName(specifier: string): string {
	const bare = specifier.replace(QUERY, "");
	return (
		builtinName(bare)
		?? bare
			.split("/")
			.slice(0, bare.startsWith("@") ? 2 : 1)
			.join("/")
	);
}

interface ManifestDependencies {
	readonly application: boolean;
	readonly development: ReadonlySet<string>;
	readonly entryPoints: readonly EntryPoint[];
	readonly private: boolean;
	readonly privateFiles: ReadonlySet<string>;
	readonly runtime: ReadonlySet<string>;
	readonly shipped: ReadonlySet<string>;
}

async function manifestDependencies(
	inputs: RuleInputs,
	owner: WorkspacePackage,
	graph: ImportGraph,
	workspace: ReadonlyMap<string, string>,
): Promise<ManifestDependencies> {
	const path = posix.join(owner.directory, "package.json");
	const manifest = await readPackageManifest(inputs.readText, path);
	if (manifest === undefined) {
		throw new Error("the manifest is missing");
	}
	return {
		...bundleInputs(graph, owner, manifest, (candidate) => developmentFile(owner, candidate)),
		application: isApplication(manifest),
		development: new Set(dependencyNames(manifest, "devDependencies")),
		entryPoints: await entryPointsOf(inputs, owner.directory, manifest, workspace),
		private: Reflect.get(manifest, "private") === true,
		shipped: new Set(SHIPPED_FIELDS.flatMap((field) => dependencyNames(manifest, field))),
	};
}

function developmentFile(owner: WorkspacePackage, path: string): boolean {
	return isTestCode(path) || isTooling(owner.directory, path);
}

function developmentImport(policy: ManifestDependencies | undefined, owner: WorkspacePackage, path: string, runtime: ReadonlySet<string>) {
	if (runtime.has(path)) {
		return false;
	}
	return developmentFile(owner, path) || policy?.privateFiles.has(path);
}

function declares(policy: ManifestDependencies, target: string, development: boolean): boolean {
	return (
		policy.shipped.has(target)
		|| (development && policy.development.has(target))
		|| (policy.application && provider(policy.entryPoints, target, development, true) !== undefined)
	);
}

function undeclared(owner: WorkspacePackage, policy: ManifestDependencies | undefined, target: string, development: boolean): string {
	const missing = policy?.private === true ? provider(policy.entryPoints, target, development, false) : undefined;
	const entryPoint =
		missing === undefined
			? ""
			: ` An application can instead add "${missing.name}" to ${missing.testOnly ? "devDependencies" : "dependencies"}, which brings it.`;
	const scope = development
		? " Tooling, test code and export-blocked bundle inputs may also use devDependencies."
		: " devDependencies are only available to tests, test support, tooling and export-blocked bundle inputs unreachable from runtime code.";
	return `Imports workspace package "${target}" without declaring it in ${posix.join(owner.directory, "package.json")}. Add it to dependencies, peerDependencies or optionalDependencies, or remove the import.${entryPoint}${scope}`;
}

export const importsManifest = defineRule({
	check: async (inputs) => {
		const graph = await importGraph(inputs);
		const root: WorkspacePackage | undefined =
			(await readPackageManifest(inputs.readText, "package.json")) === undefined ? undefined : { directory: ".", name: "." };
		const owners = [...graph.packages, ...(root === undefined ? [] : [root])];
		const workspace = new Map(graph.packages.map((owner) => [owner.name, owner.directory]));
		const policies = new Map(
			await Promise.all(owners.map(async (owner) => [owner, await manifestDependencies(inputs, owner, graph, workspace)] as const)),
		);
		const runtime = new Set([...policies.values()].flatMap((policy) => [...policy.runtime]));
		const named = new Map(graph.packages.map((owner) => [owner.name, owner]));
		const requests = [...graph.edges, ...graph.unresolved.filter((request) => request.missing === undefined)];
		return requests.flatMap((request) => {
			const owner = packageOf(graph.packages, request.from) ?? root;
			const target =
				("to" in request && request.to.kind === "file" ? packageOf(graph.packages, request.to.path) : undefined)
				?? named.get(packageName(request.specifier));
			if (owner === undefined || target === undefined || owner === target) {
				return [];
			}
			const policy = policies.get(owner);
			const development = developmentImport(policy, owner, request.from, runtime) === true;
			if (policy !== undefined && declares(policy, target.name, development)) {
				return [];
			}
			return [{ file: request.from, line: request.line, message: undeclared(owner, policy, target.name, development), subject: target.name }];
		});
	},
	description:
		"Workspace imports follow the importing package's manifest; devDependencies are available only outside runtime code, including export-blocked bundle inputs, and an application also reaches the dependencies of the entry points it declares: @shivaedev/platform for any code and @shivaedev/test-story for test code.",
	id: "imports/manifest",
});
