import { posix } from "node:path";
import type { RuleInputs } from "../../../rule.ts";
import { itemsOf, type Json, member, parseJsonc, textOf } from "./json.ts";

export type Config =
	| { readonly _tag: "Config"; readonly path: string; readonly base: string; readonly json: Json }
	| { readonly _tag: "Unreadable"; readonly path: string; readonly reason: string };

const ROOT_CONFIGS: ReadonlyArray<string> = ["biome.json", "biome.jsonc"];

const NESTED = /(?:^|\/)biome\.jsonc?$/;

const directoryOf = (path: string): string => (posix.dirname(path) === "." ? "" : posix.dirname(path));

const localExtends = (path: string, json: Json): ReadonlyArray<string> => {
	const node = member(json, "extends");
	const entries = node?._tag === "Array" ? itemsOf(node).flatMap((item) => textOf(item) ?? []) : [textOf(node) ?? ""];
	return entries.filter((entry) => entry.startsWith(".")).map((entry) => posix.join(posix.dirname(path), entry));
};

const load = async (readText: RuleInputs["readText"], path: string, base: string, seen: Set<string>): Promise<ReadonlyArray<Config>> => {
	if (seen.has(path)) {
		return [];
	}
	seen.add(path);
	const text = await readText(path);
	if (text === undefined) {
		return [{ _tag: "Unreadable", path, reason: "the file does not exist" }];
	}
	const parsed = parseJsonc(path, text);
	if (parsed._tag === "Unreadable") {
		return [{ _tag: "Unreadable", path, reason: parsed.reason }];
	}
	const extended = await Promise.all(localExtends(path, parsed.json).map((target) => load(readText, target, base, seen)));
	return [{ _tag: "Config", base, json: parsed.json, path }, ...extended.flat()];
};

const rootConfig = async (readText: RuleInputs["readText"]): Promise<string | undefined> => {
	const present = await Promise.all(ROOT_CONFIGS.map(async (path) => ((await readText(path)) === undefined ? [] : [path])));
	return present.flat()[0];
};

export const biomeConfigs = async ({ files, readText }: RuleInputs): Promise<ReadonlyArray<Config>> => {
	const seen = new Set<string>();
	const root = await rootConfig(readText);
	const nested = files.filter((path) => NESTED.test(path) && path !== root);
	const roots = root === undefined ? [] : await load(readText, root, "", seen);
	const below = await Promise.all(nested.map((path) => load(readText, path, directoryOf(path), seen)));
	return [...roots, ...below.flat()];
};
