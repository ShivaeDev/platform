import type { builtInRules } from "#rules/built-in.ts";
import type { Rule } from "./rule.ts";

export type Level = "error" | "warn" | "off";

export type RuleSetting<Input> = Level | { readonly level?: Level; readonly options?: Input };

type InputOf<Candidate> = Candidate extends Rule<string, infer Input> ? Input : never;

export type RuleSettings<Rules extends readonly Rule[]> = {
	readonly [Candidate in Rules[number] as Candidate["id"]]?: RuleSetting<InputOf<Candidate>>;
};

export type BuiltInRules = typeof builtInRules;

export interface QualityConfig<Local extends readonly Rule[] = readonly Rule[]> {
	readonly baseline?: string;
	readonly exclude?: readonly string[];
	readonly extensions?: readonly string[];
	readonly local?: Local;
	readonly registry?: string;
	readonly rules?: RuleSettings<readonly [...BuiltInRules, ...Local]>;
	readonly sources?: readonly string[];
}

export const defineConfig = <const Local extends readonly Rule[] = readonly []>(config: QualityConfig<Local>): QualityConfig<Local> => config;
