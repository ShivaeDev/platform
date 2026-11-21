import { isBuiltin } from "node:module";
import { dirname, isAbsolute, join, posix, relative, sep } from "node:path";
import { Option } from "effect";
import type { Plugin, Rollup } from "vite";
import { runNode } from "#adapters/runNode.ts";
import { projectFolder } from "#project.ts";
import { type BundleGraph, type BundleModule, type ServerMarkers, serverCodeIn } from "#serverCode.ts";

const BROWSER_EXTERNAL = "__vite-browser-external:";

// The entries that name, as a path or a glob from the project's root, a folder the module is in.
function foldersHolding(id: string, root: string, oldFormFolders: readonly string[]): readonly string[] {
	const file = relative(root, id);
	if (oldFormFolders.length === 0 || !isAbsolute(id) || file.startsWith("..")) {
		return [];
	}
	const parts = file.split(sep).slice(0, -1);
	const folders = parts.map((_, index) => parts.slice(0, index + 1).join("/"));
	return oldFormFolders.filter((entry) => {
		const pattern = posix.normalize(entry).replace(/\/$/u, "");
		return folders.some((folder) => posix.matchesGlob(folder, pattern));
	});
}

type Statement = ReturnType<Rollup.PluginContext["parse"]>["body"][number];
type ExportName = Extract<Statement, { type: "ExportNamedDeclaration" }>["specifiers"][number]["local"];

function nameOf(name: ExportName): string {
	return name.type === "Literal" ? name.value : name.name;
}

function takenBy(statement: Statement, everything: readonly string[]): readonly string[] {
	switch (statement.type) {
		case "ImportDeclaration":
			return statement.specifiers.flatMap((specifier) => {
				if (specifier.type === "ImportNamespaceSpecifier") {
					return everything;
				}
				return [specifier.type === "ImportSpecifier" ? nameOf(specifier.imported) : "default"];
			});
		case "ExportNamedDeclaration":
			return statement.specifiers.map((specifier) => nameOf(specifier.local));
		case "ExportAllDeclaration":
			return everything;
		default:
			return [];
	}
}

// The names a module takes from operation.ts, read from its code as the bundler holds it. A namespace import, a dynamic import
// or a re-export of everything takes every export, so none of them hides a query or a command from the check.
async function namesFromOperation(context: Rollup.PluginContext, info: Rollup.ModuleInfo, operation: Option.Option<string>) {
	if (Option.isNone(operation)) {
		return [];
	}
	const everything = context.getModuleInfo(operation.value)?.exports ?? [];
	const dynamic = info.dynamicallyImportedIds.includes(operation.value) ? everything : [];
	if (!info.importedIds.includes(operation.value) || info.code === null) {
		return dynamic;
	}
	const taken = await Promise.all(
		context.parse(info.code).body.map(async (statement) => {
			const source = "source" in statement ? statement.source : null;
			if (source === null || (await context.resolve(source.value, info.id))?.id !== operation.value) {
				return [];
			}
			return takenBy(statement, everything);
		}),
	);
	return [...dynamic, ...taken.flat()];
}

async function graphOf(
	context: Rollup.PluginContext,
	root: string,
	oldFormFolders: readonly string[],
	operation: Option.Option<string>,
): Promise<BundleGraph> {
	const modules = new Map<string, BundleModule>();
	const entries: string[] = [];
	for (const id of context.getModuleIds()) {
		const info = context.getModuleInfo(id);
		if (info !== null) {
			if (info.isEntry) {
				entries.push(id);
			}
			const bare = id.startsWith(BROWSER_EXTERNAL) ? id.slice(BROWSER_EXTERNAL.length) : id;
			modules.set(id, {
				builtin: isBuiltin(bare),
				fromOperation: await namesFromOperation(context, info, operation),
				imports: [...info.importedIds, ...info.dynamicallyImportedIds],
				oldFormFolders: foldersHolding(id, root, oldFormFolders),
			});
		}
	}
	return { entries, modules };
}

async function resolvedFromRoot(context: Rollup.PluginContext, root: string, specifier: string) {
	return Option.fromNullishOr((await context.resolve(specifier, join(root, "index.html")))?.id);
}

async function markersFrom(context: Rollup.PluginContext, root: string): Promise<ServerMarkers> {
	return {
		defineModule: await resolvedFromRoot(context, root, "@shivaedev/contract/defineModule.ts"),
		sql: Option.map(await resolvedFromRoot(context, root, "effect/sql"), dirname),
	};
}

export function bundleCheck(serverOnly: readonly string[], oldFormFolders: readonly string[] = []): Plugin {
	let root = ".";
	return {
		apply: "build",
		applyToEnvironment: (environment) => environment.config.consumer === "client",
		async buildEnd(this: Rollup.PluginContext, error) {
			if (error !== undefined) {
				return;
			}
			const project = await runNode(projectFolder(root));
			const operation = await resolvedFromRoot(this, root, "@shivaedev/contract/operation.ts");
			const graph = await graphOf(this, project, oldFormFolders, operation);
			const found = await runNode(serverCodeIn(graph, await markersFrom(this, root), { oldFormFolders, root: project, serverOnly }));
			if (Option.isSome(found)) {
				this.error(found.value);
			}
		},
		configResolved(resolved) {
			root = resolved.root;
		},
		name: "shivaedev:build-bundle-check",
	};
}
