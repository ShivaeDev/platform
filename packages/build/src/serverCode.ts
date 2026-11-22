import { Effect, Option, Path } from "effect";
import { type Owner, ownerOf } from "#ownerOf.ts";
import { serverCodeFailure } from "#serverCodeFailure.ts";
import { unusedOldFormFolders } from "#unusedOldFormFolders.ts";

export interface BundleModule {
	readonly builtin: boolean;
	readonly fromOperation: readonly string[];
	readonly imports: readonly string[];
	readonly oldFormFolders: readonly string[];
}

export interface BundleGraph {
	readonly entries: readonly string[];
	readonly modules: ReadonlyMap<string, BundleModule>;
}

export interface ServerMarkers {
	readonly defineModule: ReadonlySet<string>;
	readonly sql: ReadonlySet<string>;
}

export interface ServerCodeOptions {
	readonly oldFormFolders: readonly string[];
	readonly root: string;
	readonly serverOnly: readonly string[];
}

function definesOperations(module: BundleModule): boolean {
	return module.fromOperation.includes("query") || module.fromOperation.includes("command");
}

const reasonOf = Effect.fn("Build.reasonOf")(function* (
	id: string,
	module: BundleModule,
	markers: ServerMarkers,
	options: ServerCodeOptions,
	owners: Map<string, Option.Option<Owner>>,
) {
	const path = yield* Path.Path;
	if (module.builtin) {
		return Option.some("a Node builtin");
	}
	if (module.imports.some((imported) => markers.defineModule.has(imported))) {
		return Option.some("a module file: it calls defineModule");
	}
	if (definesOperations(module) && module.oldFormFolders.length === 0) {
		return Option.some("an operation file: it defines a query or a command");
	}
	const owner = yield* ownerOf(id, owners);
	if (Option.isSome(owner) && options.serverOnly.includes(owner.value.name)) {
		return Option.some(`part of ${owner.value.name}, which is listed as server-only`);
	}
	const folders = Option.match(owner, { onNone: () => "", onSome: ({ directory }) => path.dirname(path.relative(directory, id)) });
	if (folders.split(path.sep).includes("server")) {
		return Option.some("under a server/ folder");
	}
	return Option.none<string>();
});

// Effect's own index re-exports modules that import effect/sql, which tree shaking drops, so the import edge decides: every
// importer of effect/sql outside Effect counts, however many paths inside Effect reach the same module sooner.
const importsSqlFromOutside = Effect.fn("Build.importsSqlFromOutside")(function* (
	importer: string,
	imported: string,
	markers: ServerMarkers,
	owners: Map<string, Option.Option<Owner>>,
) {
	const path = yield* Path.Path;
	if (![...markers.sql].some((directory) => imported.startsWith(`${directory}${path.sep}`))) {
		return false;
	}
	const sqlOwner = yield* ownerOf(imported, owners);
	const importerOwner = yield* ownerOf(importer, owners);
	return !Option.exists(importerOwner, (each) => Option.exists(sqlOwner, ({ directory }) => each.directory === directory));
});

function chainTo(id: string, parents: ReadonlyMap<string, string | undefined>): readonly string[] {
	const chain: string[] = [];
	for (let each: string | undefined = id; each !== undefined; each = parents.get(each)) {
		chain.unshift(each);
	}
	return chain;
}

interface Walk {
	readonly excusing: Set<string>;
	readonly owners: Map<string, Option.Option<Owner>>;
	readonly parents: Map<string, string | undefined>;
	readonly pending: string[];
}

const visit = Effect.fn("Build.visit")(function* (id: string, module: BundleModule, walk: Walk, markers: ServerMarkers, options: ServerCodeOptions) {
	const reason = yield* reasonOf(id, module, markers, options, walk.owners);
	if (Option.isSome(reason)) {
		return Option.some(yield* serverCodeFailure(chainTo(id, walk.parents), reason.value, options.root, walk.owners));
	}
	if (definesOperations(module)) {
		for (const folder of module.oldFormFolders) {
			walk.excusing.add(folder);
		}
	}
	for (const imported of module.imports) {
		if (yield* importsSqlFromOutside(id, imported, markers, walk.owners)) {
			return Option.some(
				yield* serverCodeFailure([...chainTo(id, walk.parents), imported], "Effect's SQL client, effect/sql", options.root, walk.owners),
			);
		}
		if (!walk.parents.has(imported)) {
			walk.parents.set(imported, id);
			walk.pending.push(imported);
		}
	}
	return Option.none<string>();
});

// Breadth first from the entries, so the chain printed is a shortest one to the nearest server module.
export const serverCodeIn = Effect.fn("Build.serverCodeIn")(function* (graph: BundleGraph, markers: ServerMarkers, options: ServerCodeOptions) {
	const walk: Walk = {
		excusing: new Set(),
		owners: new Map(),
		parents: new Map(graph.entries.map((entry) => [entry, undefined])),
		pending: [...graph.entries],
	};
	for (let id = walk.pending.shift(); id !== undefined; id = walk.pending.shift()) {
		const module = graph.modules.get(id);
		const found = module === undefined ? Option.none<string>() : yield* visit(id, module, walk, markers, options);
		if (Option.isSome(found)) {
			return found;
		}
	}
	return unusedOldFormFolders(options.oldFormFolders, walk.excusing);
});
