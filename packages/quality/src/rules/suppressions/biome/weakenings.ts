import { entriesOf, isFalse, itemsOf, type Json, member, textOf } from "./json.ts";

export interface Weakening {
	readonly rule: string;
	readonly includes: ReadonlyArray<string>;
	readonly file: string;
	readonly line: number;
}

interface Setting {
	readonly rule: string;
	readonly line: number;
}

const LINT_WEAK = new Set(["off", "warn", "info"]);
const ASSIST_WEAK = new Set(["off"]);
const PRESETS = new Set(["recommended", "preset"]);

const levelOf = (node: Json): string | undefined => textOf(node) ?? textOf(member(node, "level"));

const at = (rule: string, node: Json | undefined): ReadonlyArray<Setting> => (node === undefined ? [] : [{ line: node.line, rule }]);

const disabled = (rule: string, section: Json | undefined): ReadonlyArray<Setting> =>
	isFalse(member(section, "enabled")) ? at(rule, member(section, "enabled")) : [];

const withoutDefaults = (rule: string, set: Json | undefined): ReadonlyArray<Setting> => [
	...(isFalse(member(set, "recommended")) ? at(rule, member(set, "recommended")) : []),
	...(textOf(member(set, "preset")) === "none" ? at(rule, member(set, "preset")) : []),
];

const groupSettings = (prefix: string, weak: ReadonlySet<string>, groups: Json | undefined): ReadonlyArray<Setting> =>
	entriesOf(groups)
		.filter(([group]) => !PRESETS.has(group))
		.flatMap(([group, rules]) => [
			...(weak.has(textOf(rules) ?? "") ? at(`${prefix}/${group}`, rules) : []),
			...withoutDefaults(`${prefix}/${group}`, rules),
			...entriesOf(rules)
				.filter(([rule, setting]) => !PRESETS.has(rule) && weak.has(levelOf(setting) ?? ""))
				.flatMap(([rule, setting]) => at(`${prefix}/${group}/${rule}`, setting)),
		]);

const linter = (section: Json | undefined): ReadonlyArray<Setting> => [
	...disabled("lint", section),
	...withoutDefaults("lint/recommended", member(section, "rules")),
	...groupSettings("lint", LINT_WEAK, member(section, "rules")),
	...entriesOf(member(section, "domains"))
		.filter(([, value]) => textOf(value) === "none")
		.flatMap(([domain, value]) => at(`lint/domains/${domain}`, value)),
];

const assist = (section: Json | undefined): ReadonlyArray<Setting> => [
	...disabled("assist", section),
	...withoutDefaults("assist/recommended", member(section, "actions")),
	...groupSettings("assist", ASSIST_WEAK, member(section, "actions")),
];

const LANGUAGES: ReadonlyArray<string> = ["javascript", "json", "css", "graphql", "grit", "html"];

const TOOLS: ReadonlyArray<readonly [string, string]> = [
	["linter", "lint"],
	["assist", "assist"],
	["formatter", "format"],
];

const SCOPED_SECTIONS: ReadonlyArray<readonly [string, string]> = [["files", "files"], ...TOOLS];

const scopeSettings = (scope: Json): ReadonlyArray<Setting> => [
	...linter(member(scope, "linter")),
	...assist(member(scope, "assist")),
	...disabled("format", member(scope, "formatter")),
	...LANGUAGES.flatMap((language) => TOOLS.flatMap(([key, name]) => disabled(`${language}/${name}`, member(member(scope, language), key)))),
];

const scoped = (base: string, glob: string): string => {
	const [, negation = "", path = glob] = /^(!*)(.*)$/.exec(glob) ?? [];
	return base === "" ? glob : `${negation}${base}/${path}`;
};

const includesOf = (override: Json): ReadonlyArray<string> => {
	const includes = itemsOf(member(override, "includes")).flatMap((item) => textOf(item) ?? []);
	return includes.length === 0 ? ["**"] : includes;
};

const narrowsScope = (globs: ReadonlyArray<string>): boolean =>
	globs.length > 0 && (globs.some((glob) => glob.startsWith("!")) || !globs.includes("**"));

const narrowings = (config: Json, file: string, base: string): ReadonlyArray<Weakening> =>
	SCOPED_SECTIONS.flatMap(([key, name]) => {
		const list = member(member(config, key), "includes");
		const globs = itemsOf(list).flatMap((item) => textOf(item) ?? []);
		return list === undefined || !narrowsScope(globs)
			? []
			: [{ file, includes: globs.map((glob) => scoped(base, glob)), line: list.line, rule: `${name}/includes` }];
	});

export const weakeningsOf = (config: Json, file: string, base: string): ReadonlyArray<Weakening> => [
	...narrowings(config, file, base),
	...scopeSettings(config).map((setting) => ({ ...setting, file, includes: [scoped(base, "**")] })),
	...itemsOf(member(config, "overrides")).flatMap((override) =>
		scopeSettings(override).map((setting) => ({ ...setting, file, includes: includesOf(override).map((glob) => scoped(base, glob)) })),
	),
];
