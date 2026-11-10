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
	parent: string | undefined,
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
	// Effect's own index re-exports modules that import effect/sql, which tree shaking drops; an import from outside Effect is real.
	if (Option.exists(markers.sql, (directory) => id.startsWith(`${directory}${path.sep}`))) {
		const importer = parent === undefined ? Option.none<Owner>() : yield* ownerOf(parent, owners);
		if (!Option.exists(importer, (each) => Option.exists(owner, ({ directory }) => each.directory === directory))) {
			return Option.some("Effect's SQL client, effect/sql");
		}
	}
	if (Option.isSome(owner) && options.serverOnly.includes(owner.value.name)) {
		return Option.some(`part of ${owner.value.name}, which is listed as server-only`);
	}
	const folders = Option.match(owner, { onNone: () => "", onSome: ({ directory }) => path.dirname(path.relative(directory, id)) });
	if (folders.split(path.sep).includes("server")) {
		return Option.some("under a server/ folder");
	}
	return Option.none<string>();
});

function chainTo(id: string, parents: ReadonlyMap<string, string | undefined>): readonly string[] {
	const chain: string[] = [];
	for (let each: string | undefined = id; each !== undefined; each = parents.get(each)) {
		chain.unshift(each);
	}
	return chain;
}

// Breadth first from the entries, so the chain printed is a shortest one to the nearest server module.
export const serverCodeIn = Effect.fn("Build.serverCodeIn")(function* (graph: BundleGraph, markers: ServerMarkers, options: ServerCodeOptions) {
	const owners = new Map<string, Option.Option<Owner>>();
	const parents = new Map<string, string | undefined>(graph.entries.map((entry) => [entry, undefined]));
	const pending = [...graph.entries];
	for (let id = pending.shift(); id !== undefined; id = pending.shift()) {
		const module = graph.modules.get(id);
		if (module !== undefined) {
			const reason = yield* reasonOf(id, parents.get(id), module, markers, options, owners);
			if (Option.isSome(reason)) {
				const chain = yield* Effect.forEach(chainTo(id, parents), (each) => displayed(each, options, owners));
				return Option.some(
					[
						`Server code reached the browser bundle: ${chain.at(-1)} is ${reason.value}. The import chain from the client entry:`,
						...chain.map((each, index) => (index === 0 ? `  ${each}` : `  → ${each}`)),
						"The browser reaches a defined module through its generated client in src/generated and imports no server code.",
					].join("\n"),
				);
			}
			for (const imported of module.imports) {
				if (!parents.has(imported)) {
					parents.set(imported, id);
					pending.push(imported);
				}
			}
		}
	}
	return Option.none<string>();
});
