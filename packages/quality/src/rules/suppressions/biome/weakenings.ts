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

function levelOf(node: Json): string | undefined {
	return textOf(node) ?? textOf(member(node, "level"));
}

function at(rule: string, node: Json | undefined, weak: boolean, wholeGroup = false): readonly Setting[] {
	return node === undefined ? [] : [{ line: node.line, rule, weak, wholeGroup }];
}

function enabled(rule: string, section: Json | undefined): readonly Setting[] {
	return at(rule, member(section, "enabled"), isFalse(member(section, "enabled")));
}

function defaults(rule: string, set: Json | undefined): readonly Setting[] {
	return [
		...at(rule, member(set, "recommended"), isFalse(member(set, "recommended"))),
		...at(rule, member(set, "preset"), textOf(member(set, "preset")) === "none"),
	];
}

function ruleSettings(group: string, weak: ReadonlySet<string>, rules: Json): readonly Setting[] {
	return entriesOf(rules)
		.filter(([rule]) => !PRESETS.has(rule))
		.flatMap(([rule, setting]) => {
			const level = levelOf(setting);
			return level === undefined ? [] : at(`${group}/${rule}`, setting, weak.has(level));
		});
}

function groupSettings(prefix: string, weak: ReadonlySet<string>, groups: Json | undefined): readonly Setting[] {
	return entriesOf(groups)
		.filter(([group]) => !PRESETS.has(group))
		.flatMap(([group, rules]) => {
			const severity = textOf(rules);
			return severity === undefined
				? [...defaults(`${prefix}/${group}`, rules), ...ruleSettings(`${prefix}/${group}`, weak, rules)]
				: at(`${prefix}/${group}`, rules, weak.has(severity), true);
		});
}

function linter(section: Json | undefined): readonly Setting[] {
	return [
		...enabled("lint", section),
		...defaults("lint/recommended", member(section, "rules")),
		...groupSettings("lint", LINT_WEAK, member(section, "rules")),
		...entriesOf(member(section, "domains")).flatMap(([domain, value]) => at(`lint/domains/${domain}`, value, textOf(value) === "none")),
	];
}

function assist(section: Json | undefined): readonly Setting[] {
	return [
		...enabled("assist", section),
		...defaults("assist/recommended", member(section, "actions")),
		...groupSettings("assist", ASSIST_WEAK, member(section, "actions")),
	];
}

const LANGUAGES: readonly string[] = ["javascript", "json", "css", "graphql", "grit", "html"];

const TOOLS: ReadonlyArray<readonly [string, string]> = [
	["linter", "lint"],
	["assist", "assist"],
	["formatter", "format"],
];

const SCOPED_SECTIONS: ReadonlyArray<readonly [string, string]> = [["files", "files"], ...TOOLS];

function settingsOf(scope: Json): readonly Setting[] {
	return [
		...linter(member(scope, "linter")),
		...assist(member(scope, "assist")),
		...enabled("format", member(scope, "formatter")),
		...LANGUAGES.flatMap((language) => TOOLS.flatMap(([key, name]) => enabled(`${language}/${name}`, member(member(scope, language), key)))),
	];
}

function replaces(later: Setting, earlier: Setting): boolean {
	return later.rule === earlier.rule || (later.wholeGroup && earlier.rule.startsWith(`${later.rule}/`));
}

function includesOf(override: Json): readonly string[] {
	const includes = itemsOf(member(override, "includes")).flatMap((item) => textOf(item) ?? []);
	return includes.length === 0 ? ["**"] : includes;
}

function narrowsScope(globs: readonly string[]): boolean {
	return globs.length > 0 && (globs.some((glob) => glob.startsWith("!")) || !globs.includes("**"));
}

function narrowings(config: Json, base: string): readonly Omit<Weakening, "layer">[] {
	return SCOPED_SECTIONS.flatMap(([key, name]) => {
		const list = member(member(config, key), "includes");
		const globs = itemsOf(list).flatMap((item) => textOf(item) ?? []);
		return list === undefined || !narrowsScope(globs)
			? []
			: [{ includes: globs.map((glob) => scoped(base, glob)), line: list.line, rule: `${name}/includes` }];
	});
}

function layerWeakenings(layer: Layer, later: readonly Layer[], base: string): readonly Weakening[] {
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
}

export function weakeningsOf({ base, layers }: Chain): readonly Weakening[] {
	return layers.flatMap((layer, index) => layerWeakenings(layer, layers.slice(index + 1), base));
}
