import { posix } from "node:path";
import { Effect } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { type ImportGraph, importGraph } from "#imports/graph.ts";
import { isTooling } from "#imports/isTooling.ts";
import { builtinName } from "#imports/packageName.ts";
import { packageOf, type WorkspacePackage } from "#imports/workspace.ts";
import { dependencyNames, type EntryPoint, entryPointsOf, isApplication, provider, SHIPPED_FIELDS } from "#manifests/entryPoints.ts";
import { testCode } from "#naming/testCode.ts";
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

const manifestDependencies = Effect.fn("Imports.manifestDependencies")(function* (
	inputs: RuleInputs,
	owner: WorkspacePackage,
	graph: ImportGraph,
	workspace: ReadonlyMap<string, string>,
	isTestCode: (path: string) => boolean,
): Effect.fn.Return<ManifestDependencies> {
	const path = posix.join(owner.directory, "package.json");
	const manifest = yield* Effect.promise(() => readPackageManifest(inputs.readText, path));
	if (manifest === undefined) {
		return yield* Effect.die(new Error("the manifest is missing"));
	}
	return {
		...bundleInputs(graph, owner, manifest, (candidate) => developmentFile(owner, candidate, isTestCode)),
		application: isApplication(manifest),
		development: new Set(dependencyNames(manifest, "devDependencies")),
		entryPoints: yield* Effect.promise(() => entryPointsOf(inputs, owner.directory, manifest, workspace)),
		private: Reflect.get(manifest, "private") === true,
		shipped: new Set(SHIPPED_FIELDS.flatMap((field) => dependencyNames(manifest, field))),
	};
});

function developmentFile(owner: WorkspacePackage, path: string, isTestCode: (path: string) => boolean): boolean {
	return isTestCode(path) || isTooling(owner.directory, path);
}

function developmentImport(
	policy: ManifestDependencies | undefined,
	owner: WorkspacePackage,
	path: string,
	runtime: ReadonlySet<string>,
	isTestCode: (path: string) => boolean,
) {
	if (runtime.has(path)) {
		return false;
	}
	return developmentFile(owner, path, isTestCode) || policy?.privateFiles.has(path);
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
	check: Effect.fn("Imports.check")(function* (inputs) {
		const graph = yield* importGraph(inputs);
		const isTestCode = yield* testCode(inputs);
		const root: WorkspacePackage | undefined =
			(yield* Effect.promise(() => readPackageManifest(inputs.readText, "package.json"))) === undefined ? undefined : { directory: ".", name: "." };
		const owners = [...graph.packages, ...(root === undefined ? [] : [root])];
		const workspace = new Map(graph.packages.map((owner) => [owner.name, owner.directory]));
		const policies = new Map(
			yield* Effect.forEach(
				owners,
				(owner) =>
					Effect.map(
						manifestDependencies(inputs, owner, graph, workspace, isTestCode),
						(policy): readonly [WorkspacePackage, ManifestDependencies] => [owner, policy],
					),
				{ concurrency: "unbounded" },
			),
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
			const development = developmentImport(policy, owner, request.from, runtime, isTestCode) === true;
			if (policy !== undefined && declares(policy, target.name, development)) {
				return [];
			}
			return [{ file: request.from, line: request.line, message: undeclared(owner, policy, target.name, development), subject: target.name }];
		});
	}),
	description:
		"Workspace imports follow the importing package's manifest; devDependencies are available only outside runtime code, including export-blocked bundle inputs, and an application also reaches the dependencies of the entry points it declares: @shivaedev/platform for any code and @shivaedev/test-story for test code.",
	id: "imports/manifest",
});
