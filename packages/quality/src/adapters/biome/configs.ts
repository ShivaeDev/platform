import { posix } from "node:path";
import { Effect } from "effect";
import { resolvePackage } from "#adapters/biome/resolvePackage.ts";
import type { ManifestFailure } from "#adapters/manifestInventory.ts";
import type { FilesystemFailure } from "#inventory/filesystem.ts";
import type { Finding, RuleInputs } from "#rule.ts";
import { type Declaration, decodeShipped, PRESET_DECLARATIONS } from "#rules/suppressions/biome/declarations.ts";
import { itemsOf, type Json, member, type Parsed, parseJsonc, textOf } from "#rules/suppressions/biome/json.ts";

export interface Preset {
	readonly declared: readonly Declaration[];
	readonly file: string;
	readonly line: number;
	readonly specifier: string;
}

export interface Layer {
	readonly json: Json;
	readonly path: string;
	readonly preset: Preset | undefined;
}

export interface Chain {
	readonly base: string;
	readonly layers: readonly Layer[];
}

interface Loaded {
	readonly layers: readonly Layer[];
	readonly problems: readonly Finding[];
}

type ReadText = RuleInputs["readText"];

const ROOT_CONFIGS: readonly string[] = ["biome.json", "biome.jsonc"];

const NESTED = /(?:^|\/)biome\.jsonc?$/u;

const RELATIVE = /^\.\.?(?:\/|$)/u;

function directoryOf(path: string): string {
	return posix.dirname(path) === "." ? "" : posix.dirname(path);
}

const read = Effect.fn("Biome.read")(function* (readText: ReadText, path: string): Effect.fn.Return<Parsed, FilesystemFailure> {
	const text = yield* readText(path);
	return text === undefined ? { _tag: "Unreadable", reason: "the file does not exist" } : parseJsonc(path, text);
});

function problem(file: string, message: string, line?: number): Loaded {
	return { layers: [], problems: [{ file, line, message }] };
}

const local = Effect.fn("Biome.local")(function* (readText: ReadText, path: string): Effect.fn.Return<Loaded, FilesystemFailure> {
	const parsed = yield* read(readText, path);
	return parsed._tag === "Parsed"
		? { layers: [{ json: parsed.json, path, preset: undefined }], problems: [] }
		: problem(path, `Cannot read this Biome config: ${parsed.reason}.`);
});

const fromPackage = Effect.fn("Biome.fromPackage")(function* (
	readText: ReadText,
	from: string,
	entry: Json,
	specifier: string,
): Effect.fn.Return<Loaded, FilesystemFailure | ManifestFailure> {
	const target = yield* resolvePackage(readText, specifier);
	if (target === undefined) {
		return problem(from, `Cannot resolve the Biome config "${specifier}" from node_modules.`, entry.line);
	}
	const parsed = yield* read(readText, target);
	if (parsed._tag === "Unreadable") {
		return problem(from, `Cannot read the Biome config "${specifier}" at ${target}: ${parsed.reason}.`, entry.line);
	}
	const shipped = posix.join(posix.dirname(target), PRESET_DECLARATIONS);
	const declared = decodeShipped(yield* readText(shipped));
	if (declared._tag === "Invalid") {
		return problem(from, `Cannot read the declarations shipped with "${specifier}" at ${shipped}: ${declared.issues.join("; ")}.`, entry.line);
	}
	const preset = { declared: declared.value, file: from, line: entry.line, specifier };
	return { layers: [{ json: parsed.json, path: target, preset }], problems: [] };
});

const extended = Effect.fn("Biome.extended")(function* (
	readText: ReadText,
	from: string,
	entry: Json,
): Effect.fn.Return<Loaded, FilesystemFailure | ManifestFailure> {
	const specifier = textOf(entry);
	if (specifier === undefined || specifier === "//") {
		return { layers: [], problems: [] };
	}
	if (RELATIVE.test(specifier)) {
		return yield* local(readText, posix.join(posix.dirname(from), specifier));
	}
	const relative = posix.normalize(specifier);
	return yield* (yield* readText(relative)) === undefined ? fromPackage(readText, from, entry, specifier) : local(readText, relative);
});

function extendsOf(json: Json): readonly Json[] {
	return itemsOf(member(json, "extends"));
}

const chainOf = Effect.fn("Biome.chainOf")(function* (
	readText: ReadText,
	path: string,
): Effect.fn.Return<Loaded, FilesystemFailure | ManifestFailure> {
	const own = yield* local(readText, path);
	const [layer] = own.layers;
	if (layer === undefined) {
		return own;
	}
	const parents = yield* Effect.forEach(extendsOf(layer.json), (entry) => extended(readText, path, entry), { concurrency: "unbounded" });
	return { layers: [...parents.flatMap((parent) => parent.layers), layer], problems: parents.flatMap((parent) => parent.problems) };
});

const rootConfigPath = Effect.fn("Biome.rootConfigPath")(function* (readText: ReadText) {
	const present = yield* Effect.forEach(ROOT_CONFIGS, (path) => Effect.map(readText(path), (text) => (text === undefined ? [] : [path])), {
		concurrency: "unbounded",
	});
	return present.flat()[0];
});

export interface BiomeConfigs {
	readonly chains: readonly Chain[];
	readonly problems: readonly Finding[];
	readonly root: string;
}

export const biomeConfigs = Effect.fn("Biome.biomeConfigs")(function* ({
	files,
	readText,
}: RuleInputs): Effect.fn.Return<BiomeConfigs, FilesystemFailure | ManifestFailure> {
	const root = yield* rootConfigPath(readText);
	const rootChain = root === undefined ? { layers: [], problems: [] } : yield* chainOf(readText, root);
	const loaded = new Set(rootChain.layers.map((layer) => layer.path));
	const nested = files.filter((path) => NESTED.test(path) && path !== root && !loaded.has(path));
	const below = yield* Effect.forEach(nested, (path) => Effect.map(chainOf(readText, path), (chain) => ({ base: directoryOf(path), ...chain })), {
		concurrency: "unbounded",
	});
	const all = [{ base: "", ...rootChain }, ...below];
	return {
		chains: all.filter((chain) => chain.layers.length > 0).map(({ base, layers }) => ({ base, layers })),
		problems: all.flatMap((chain) => chain.problems),
		root: root ?? "biome.json",
	};
});
