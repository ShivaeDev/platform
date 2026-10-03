import type { Rule } from "./rule.ts";
import type { builtInRules } from "./rules/built-in.ts";

export type Level = "error" | "warn" | "off";

export type RuleSetting<Input> = Level | { readonly level?: Level; readonly options?: Input };

type InputOf<Candidate> = Candidate extends Rule<string, infer Input> ? Input : never;

export type RuleSettings<Rules extends ReadonlyArray<Rule>> = {
	readonly [Candidate in Rules[number] as Candidate["id"]]?: RuleSetting<InputOf<Candidate>>;
};

export type BuiltInRules = typeof builtInRules;

type IdOf<Rules extends ReadonlyArray<Rule>> = Rules[number]["id"];

export interface QualityConfig<Local extends ReadonlyArray<Rule> = ReadonlyArray<Rule>> {
	readonly sources?: ReadonlyArray<string>;
	readonly exclude?: ReadonlyArray<string>;
	readonly extensions?: ReadonlyArray<string>;
	readonly registry?: string;
	readonly baseline?: string;
	readonly adopt?: ReadonlyArray<IdOf<readonly [...BuiltInRules, ...Local]>>;
	readonly local?: Local;
	readonly rules?: RuleSettings<readonly [...BuiltInRules, ...Local]>;
}

export const defineConfig = <const Local extends ReadonlyArray<Rule> = readonly []>(config: QualityConfig<Local>): QualityConfig<Local> => config;
