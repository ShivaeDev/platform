import { Effect, Option, Path, Schema } from "effect";
import { readIfPresent } from "#files.ts";

export interface BundleModule {
	readonly builtin: boolean;
	readonly imports: readonly string[];
}

export interface BundleGraph {
	readonly entries: readonly string[];
	readonly modules: ReadonlyMap<string, BundleModule>;
}

export interface ServerMarkers {
	readonly defineModule: Option.Option<string>;
	readonly operation: Option.Option<string>;
	readonly sql: Option.Option<string>;
}

export interface ServerCodeOptions {
	readonly root: string;
	readonly serverOnly: readonly string[];
}

interface Owner {
	readonly directory: string;
	readonly name: string;
}

const Manifest = Schema.fromJsonString(Schema.Struct({ name: Schema.optionalKey(Schema.String) }));

const decodeManifest = Schema.decodeUnknownOption(Manifest);

const ownerOf = Effect.fn("Build.ownerOf")(function* (id: string, owners: Map<string, Option.Option<Owner>>) {
	const path = yield* Path.Path;
	if (!path.isAbsolute(id)) {
		return Option.none<Owner>();
	}
	const visited: string[] = [];
	for (let directory = path.dirname(id); ; directory = path.dirname(directory)) {
		const known = owners.get(directory);
		if (known !== undefined) {
			for (const each of visited) {
				owners.set(each, known);
			}
			return known;
		}
		visited.push(directory);
		const name = Option.flatMap(yield* readIfPresent(path.join(directory, "package.json")), (text) =>
			Option.flatMap(decodeManifest(text), (manifest) => Option.fromUndefinedOr(manifest.name)),
		);
		if (Option.isSome(name) || path.dirname(directory) === directory) {
			const found = Option.map(name, (each): Owner => ({ directory, name: each }));
			for (const each of visited) {
				owners.set(each, found);
			}
			return found;
		}
	}
});

const displayed = Effect.fn("Build.displayed")(function* (id: string, options: ServerCodeOptions, owners: Map<string, Option.Option<Owner>>) {
	const path = yield* Path.Path;
	const relative = path.relative(options.root, id);
	if (path.isAbsolute(id) && !relative.startsWith("..") && !relative.split(path.sep).includes("node_modules")) {
		return relative;
	}
	const owner = yield* ownerOf(id, owners);
	return Option.match(owner, {
		onNone: () => id.replace(/^__vite-browser-external:/u, ""),
		onSome: ({ directory, name }) => `${name}/${path.relative(directory, id)}`,
	});
});

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
	if (Option.exists(markers.defineModule, (marker) => module.imports.includes(marker))) {
		return Option.some("a module file: it calls defineModule");
	}
	if (Option.exists(markers.operation, (marker) => module.imports.includes(marker))) {
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
	if (!Option.exists(markers.sql, (directory) => imported.startsWith(`${directory}${path.sep}`))) {
		return false;
	}
	const sqlOwner = yield* ownerOf(imported, owners);
	const importerOwner = yield* ownerOf(importer, owners);
	return !Option.exists(importerOwner, (each) => Option.exists(sqlOwner, ({ directory }) => each.directory === directory));
});

const failure = Effect.fn("Build.failure")(function* (
	chain: readonly string[],
	reason: string,
	options: ServerCodeOptions,
	owners: Map<string, Option.Option<Owner>>,
) {
	const shown = yield* Effect.forEach(chain, (each) => displayed(each, options, owners));
	return [
		`Server code reached the browser bundle: ${shown.at(-1)} is ${reason}. The import chain from the client entry:`,
		...shown.map((each, index) => (index === 0 ? `  ${each}` : `  → ${each}`)),
		"The browser reaches a defined module through its generated client in src/generated and imports no server code.",
	].join("\n");
});

function chainTo(id: string, parents: ReadonlyMap<string, string | undefined>): readonly string[] {
	const chain: string[] = [];
	for (let each: string | undefined = id; each !== undefined; each = parents.get(each)) {
		chain.unshift(each);
	}
	return chain;
}

interface Walk {
	readonly owners: Map<string, Option.Option<Owner>>;
	readonly parents: Map<string, string | undefined>;
	readonly pending: string[];
}

const visit = Effect.fn("Build.visit")(function* (id: string, module: BundleModule, walk: Walk, markers: ServerMarkers, options: ServerCodeOptions) {
	const reason = yield* reasonOf(id, module, markers, options, walk.owners);
	if (Option.isSome(reason)) {
		return Option.some(yield* failure(chainTo(id, walk.parents), reason.value, options, walk.owners));
	}
	for (const imported of module.imports) {
		if (yield* importsSqlFromOutside(id, imported, markers, walk.owners)) {
			return Option.some(yield* failure([...chainTo(id, walk.parents), imported], "Effect's SQL client, effect/sql", options, walk.owners));
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
	const walk: Walk = { owners: new Map(), parents: new Map(graph.entries.map((entry) => [entry, undefined])), pending: [...graph.entries] };
	for (let id = walk.pending.shift(); id !== undefined; id = walk.pending.shift()) {
		const module = graph.modules.get(id);
		const found = module === undefined ? Option.none<string>() : yield* visit(id, module, walk, markers, options);
		if (Option.isSome(found)) {
			return found;
		}
	}
	return Option.none<string>();
});
