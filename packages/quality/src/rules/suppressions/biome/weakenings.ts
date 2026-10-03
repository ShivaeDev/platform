import type { Chain, Layer } from "./configs.ts";
import { scoped } from "./declarations.ts";
import { entriesOf, isFalse, itemsOf, type Json, member, textOf } from "./json.ts";

export interface Weakening {
	readonly includes: readonly string[];
	readonly layer: Layer;
	readonly line: number;
	readonly rule: string;
}

interface Setting {
	readonly line: number;
	readonly rule: string;
	readonly weak: boolean;
	readonly wholeGroup: boolean;
}

const LINT_WEAK = new Set(["off", "warn", "info"]);
const ASSIST_WEAK = new Set(["off"]);
const PRESETS = new Set(["recommended", "preset"]);

const levelOf = (node: Json): string | undefined => textOf(node) ?? textOf(member(node, "level"));

const at = (rule: string, node: Json | undefined, weak: boolean, wholeGroup = false): readonly Setting[] =>
	node === undefined ? [] : [{ line: node.line, rule, weak, wholeGroup }];

const enabled = (rule: string, section: Json | undefined): readonly Setting[] =>
	at(rule, member(section, "enabled"), isFalse(member(section, "enabled")));

const defaults = (rule: string, set: Json | undefined): readonly Setting[] => [
	...at(rule, member(set, "recommended"), isFalse(member(set, "recommended"))),
	...at(rule, member(set, "preset"), textOf(member(set, "preset")) === "none"),
];

const ruleSettings = (group: string, weak: ReadonlySet<string>, rules: Json): readonly Setting[] =>
	entriesOf(rules)
		.filter(([rule]) => !PRESETS.has(rule))
		.flatMap(([rule, setting]) => {
			const level = levelOf(setting);
			return level === undefined ? [] : at(`${group}/${rule}`, setting, weak.has(level));
		});

const groupSettings = (prefix: string, weak: ReadonlySet<string>, groups: Json | undefined): readonly Setting[] =>
	entriesOf(groups)
		.filter(([group]) => !PRESETS.has(group))
		.flatMap(([group, rules]) => {
			const severity = textOf(rules);
			return severity === undefined
				? [...defaults(`${prefix}/${group}`, rules), ...ruleSettings(`${prefix}/${group}`, weak, rules)]
				: at(`${prefix}/${group}`, rules, weak.has(severity), true);
		});

const linter = (section: Json | undefined): readonly Setting[] => [
	...enabled("lint", section),
	...defaults("lint/recommended", member(section, "rules")),
	...groupSettings("lint", LINT_WEAK, member(section, "rules")),
	...entriesOf(member(section, "domains")).flatMap(([domain, value]) => at(`lint/domains/${domain}`, value, textOf(value) === "none")),
];

const assist = (section: Json | undefined): readonly Setting[] => [
	...enabled("assist", section),
	...defaults("assist/recommended", member(section, "actions")),
	...groupSettings("assist", ASSIST_WEAK, member(section, "actions")),
];

const LANGUAGES: readonly string[] = ["javascript", "json", "css", "graphql", "grit", "html"];

const TOOLS: ReadonlyArray<readonly [string, string]> = [
	["linter", "lint"],
	["assist", "assist"],
	["formatter", "format"],
];

const SCOPED_SECTIONS: ReadonlyArray<readonly [string, string]> = [["files", "files"], ...TOOLS];

const settingsOf = (scope: Json): readonly Setting[] => [
	...linter(member(scope, "linter")),
	...assist(member(scope, "assist")),
	...enabled("format", member(scope, "formatter")),
	...LANGUAGES.flatMap((language) => TOOLS.flatMap(([key, name]) => enabled(`${language}/${name}`, member(member(scope, language), key)))),
];

const replaces = (later: Setting, earlier: Setting): boolean =>
	later.rule === earlier.rule || (later.wholeGroup && earlier.rule.startsWith(`${later.rule}/`));

const includesOf = (override: Json): readonly string[] => {
	const includes = itemsOf(member(override, "includes")).flatMap((item) => textOf(item) ?? []);
	return includes.length === 0 ? ["**"] : includes;
};

const narrowsScope = (globs: readonly string[]): boolean => globs.length > 0 && (globs.some((glob) => glob.startsWith("!")) || !globs.includes("**"));

const narrowings = (config: Json, base: string): readonly Omit<Weakening, "layer">[] =>
	SCOPED_SECTIONS.flatMap(([key, name]) => {
		const list = member(member(config, key), "includes");
		const globs = itemsOf(list).flatMap((item) => textOf(item) ?? []);
		return list === undefined || !narrowsScope(globs)
			? []
			: [{ includes: globs.map((glob) => scoped(base, glob)), line: list.line, rule: `${name}/includes` }];
	});

const layerWeakenings = (layer: Layer, later: readonly Layer[], base: string): readonly Weakening[] => {
	const overriding = later.flatMap((next) => settingsOf(next.json));
	const top = settingsOf(layer.json).filter((setting) => setting.weak && !overriding.some((next) => replaces(next, setting)));
	return [
		...narrowings(layer.json, base),
		...top.map(({ line, rule }) => ({ includes: [scoped(base, "**")], line, rule })),
		...itemsOf(member(layer.json, "overrides")).flatMap((override) =>
			settingsOf(override)
				.filter((setting) => setting.weak)
				.map(({ line, rule }) => ({ includes: includesOf(override).map((glob) => scoped(base, glob)), line, rule })),
		),
	].map((weakening) => ({ ...weakening, layer }));
};

export const weakeningsOf = ({ base, layers }: Chain): readonly Weakening[] =>
	layers.flatMap((layer, index) => layerWeakenings(layer, layers.slice(index + 1), base));
