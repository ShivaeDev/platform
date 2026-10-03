import { posix } from "node:path";
import type { Finding, RuleInputs } from "../../../rule.ts";
import { type Declaration, decodeShipped, PRESET_DECLARATIONS } from "./declarations.ts";
import { itemsOf, type Json, member, type Parsed, parseJsonc, textOf } from "./json.ts";
import { resolvePackage } from "./resolve.ts";

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

const directoryOf = (path: string): string => (posix.dirname(path) === "." ? "" : posix.dirname(path));

const read = async (readText: ReadText, path: string): Promise<Parsed> => {
	const text = await readText(path);
	return text === undefined ? { _tag: "Unreadable", reason: "the file does not exist" } : parseJsonc(path, text);
};

const problem = (file: string, message: string, line?: number): Loaded => ({ layers: [], problems: [{ file, line, message }] });

const local = async (readText: ReadText, path: string): Promise<Loaded> => {
	const parsed = await read(readText, path);
	return parsed._tag === "Parsed"
		? { layers: [{ json: parsed.json, path, preset: undefined }], problems: [] }
		: problem(path, `Cannot read this Biome config: ${parsed.reason}.`);
};

const fromPackage = async (readText: ReadText, from: string, entry: Json, specifier: string): Promise<Loaded> => {
	const target = await resolvePackage(readText, specifier);
	if (target === undefined) {
		return problem(from, `Cannot resolve the Biome config "${specifier}" from node_modules.`, entry.line);
	}
	const parsed = await read(readText, target);
	if (parsed._tag === "Unreadable") {
		return problem(from, `Cannot read the Biome config "${specifier}" at ${target}: ${parsed.reason}.`, entry.line);
	}
	const shipped = posix.join(posix.dirname(target), PRESET_DECLARATIONS);
	const declared = await decodeShipped(await readText(shipped));
	if (declared._tag === "Invalid") {
		return problem(from, `Cannot read the declarations shipped with "${specifier}" at ${shipped}: ${declared.issues.join("; ")}.`, entry.line);
	}
	const preset = { declared: declared.value, file: from, line: entry.line, specifier };
	return { layers: [{ json: parsed.json, path: target, preset }], problems: [] };
};

const extended = async (readText: ReadText, from: string, entry: Json): Promise<Loaded> => {
	const specifier = textOf(entry);
	if (specifier === undefined || specifier === "//") {
		return { layers: [], problems: [] };
	}
	if (RELATIVE.test(specifier)) {
		return local(readText, posix.join(posix.dirname(from), specifier));
	}
	const relative = posix.normalize(specifier);
	return (await readText(relative)) === undefined ? fromPackage(readText, from, entry, specifier) : local(readText, relative);
};

const extendsOf = (json: Json): readonly Json[] => itemsOf(member(json, "extends"));

const chainOf = async (readText: ReadText, path: string): Promise<Loaded> => {
	const own = await local(readText, path);
	const [layer] = own.layers;
	if (layer === undefined) {
		return own;
	}
	const parents = await Promise.all(extendsOf(layer.json).map((entry) => extended(readText, path, entry)));
	return { layers: [...parents.flatMap((parent) => parent.layers), layer], problems: parents.flatMap((parent) => parent.problems) };
};

const rootConfig = async (readText: ReadText): Promise<string | undefined> => {
	const present = await Promise.all(ROOT_CONFIGS.map(async (path) => ((await readText(path)) === undefined ? [] : [path])));
	return present.flat()[0];
};

export interface BiomeConfigs {
	readonly chains: readonly Chain[];
	readonly problems: readonly Finding[];
	readonly root: string;
}

export const biomeConfigs = async ({ files, readText }: RuleInputs): Promise<BiomeConfigs> => {
	const root = await rootConfig(readText);
	const rootChain = root === undefined ? { layers: [], problems: [] } : await chainOf(readText, root);
	const loaded = new Set(rootChain.layers.map((layer) => layer.path));
	const nested = files.filter((path) => NESTED.test(path) && path !== root && !loaded.has(path));
	const below = await Promise.all(nested.map(async (path) => ({ base: directoryOf(path), ...(await chainOf(readText, path)) })));
	const all = [{ base: "", ...rootChain }, ...below];
	return {
		chains: all.filter((chain) => chain.layers.length > 0).map(({ base, layers }) => ({ base, layers })),
		problems: all.flatMap((chain) => chain.problems),
		root: root ?? "biome.json",
	};
};
