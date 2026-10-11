import { posix } from "node:path";
import { importGraph } from "#imports/graph.ts";
import { builtinName } from "#imports/resolve.ts";
import { packageOf, type WorkspacePackage } from "#imports/workspace.ts";
import { isTestCode } from "#naming/testName.ts";
import { defineRule, type RuleInputs } from "#rule.ts";

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
	readonly development: ReadonlySet<string>;
	readonly shipped: ReadonlySet<string>;
}

function names(manifest: object, field: string): readonly string[] {
	const value: unknown = Reflect.get(manifest, field);
	if (value === undefined) {
		return [];
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${field} must be an object`);
	}
	return Object.keys(value);
}

async function manifestDependencies(inputs: RuleInputs, owner: WorkspacePackage): Promise<ManifestDependencies> {
	const path = posix.join(owner.directory, "package.json");
	try {
		const text = await inputs.readText(path);
		if (text === undefined) {
			throw new Error("the manifest is missing");
		}
		const manifest: unknown = JSON.parse(text);
		if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
			throw new Error("the manifest must be an object");
		}
		return {
			development: new Set(names(manifest, "devDependencies")),
			shipped: new Set(["dependencies", "peerDependencies", "optionalDependencies"].flatMap((field) => names(manifest, field))),
		};
	} catch (cause) {
		throw new Error(`cannot read dependency policy at ${path}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
	}
}

const TOOL_FOLDERS = new Set(["script", "scripts", "tooling"]);

const CONFIG_FILE = /(?:^|\.)config\.[cm]?[jt]sx?$/u;

function developmentFile(owner: WorkspacePackage, path: string): boolean {
	if (isTestCode(path)) {
		return true;
	}
	const local = posix.relative(owner.directory, path);
	const [folder = ""] = local.split("/");
	return TOOL_FOLDERS.has(folder) || (!local.includes("/") && CONFIG_FILE.test(local));
}

export const importsManifest = defineRule({
	check: async (inputs) => {
		const graph = await importGraph(inputs);
		const root: WorkspacePackage | undefined = (await inputs.readText("package.json")) === undefined ? undefined : { directory: ".", name: "." };
		const owners = [...graph.packages, ...(root === undefined ? [] : [root])];
		const policies = new Map(await Promise.all(owners.map(async (owner) => [owner, await manifestDependencies(inputs, owner)] as const)));
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
			const development = developmentFile(owner, request.from);
			if (policy?.shipped.has(target.name) || (development && policy?.development.has(target.name))) {
				return [];
			}
			return [
				{
					file: request.from,
					line: request.line,
					message: `Imports workspace package "${target.name}" without declaring it in ${posix.join(owner.directory, "package.json")}. Add it to dependencies, peerDependencies or optionalDependencies, or remove the import.${development ? " Tooling and test code may also use devDependencies." : " devDependencies are only available to tests, test support and tooling."}`,
					subject: target.name,
				},
			];
		});
	},
	description: "Workspace imports follow the importing package's manifest; devDependencies are available only to tests, test support and tooling.",
	id: "imports/manifest",
});
