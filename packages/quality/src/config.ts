import type { Rule } from "./rule.ts";
import type { builtInRules } from "./rules/built-in.ts";

/** Every rule defaults to `error`. `warn` is for the transition to a rule and is meant to be temporary. */
export type Level = "error" | "warn" | "off";

export type RuleSetting<Input> = Level | { readonly level?: Level; readonly options?: Input };

type InputOf<Candidate> = Candidate extends Rule<string, infer Input> ? Input : never;

export type RuleSettings<Rules extends ReadonlyArray<Rule>> = {
	readonly [Candidate in Rules[number] as Candidate["id"]]?: RuleSetting<InputOf<Candidate>>;
};

export type BuiltInRules = typeof builtInRules;

export interface QualityConfig<Local extends ReadonlyArray<Rule> = ReadonlyArray<Rule>> {
	/** Directories or files to check, relative to the config file. Defaults to the whole repository. */
	readonly sources?: ReadonlyArray<string>;
	/** Paths never checked, in .gitignore syntax. Ignored files are always skipped. */
	readonly exclude?: ReadonlyArray<string>;
	/** Extensions of the source files rules read. Defaults to TypeScript and JavaScript modules. */
	readonly extensions?: ReadonlyArray<string>;
	/** Permanent exceptions, each with a reason. Defaults to `quality/registry.json`. */
	readonly registry?: string;
	/** Existing violations that may only shrink. Defaults to `quality/baseline.json`. */
	readonly baseline?: string;
	/** Repository rules, reported, registered and baselined like the built-in ones. */
	readonly local?: Local;
	readonly rules?: RuleSettings<readonly [...BuiltInRules, ...Local]>;
}

export const defineConfig = <const Local extends ReadonlyArray<Rule> = readonly []>(config: QualityConfig<Local>): QualityConfig<Local> => config;
