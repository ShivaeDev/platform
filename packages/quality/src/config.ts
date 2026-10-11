import type { builtInRules } from "#rules/built-in.ts";
import type { Rule } from "./rule.ts";

export type Level = "error" | "warn" | "off";

export type RuleSetting<TInput> = Level | { readonly level?: Level; readonly options?: TInput };

type InputOf<TCandidate> = TCandidate extends Rule<string, infer TInput> ? TInput : never;

export type RuleSettings<TRules extends readonly Rule[]> = {
	readonly [TCandidate in TRules[number] as TCandidate["id"]]?: RuleSetting<InputOf<TCandidate>>;
};

export type BuiltInRules = typeof builtInRules;

export interface PreCommit {
	readonly run?: readonly string[];
	readonly tighten?: boolean;
}

export interface QualityConfig<TLocal extends readonly Rule[] = readonly Rule[]> {
	readonly baseline?: string;
	readonly exclude?: readonly string[];
	readonly extensions?: readonly string[];
	readonly local?: TLocal;
	readonly preCommit?: PreCommit;
	readonly registry?: string;
	readonly rules?: RuleSettings<readonly [...BuiltInRules, ...TLocal]>;
	readonly sources?: readonly string[];
}

export const defineConfig = <const TLocal extends readonly Rule[] = readonly []>(config: QualityConfig<TLocal>): QualityConfig<TLocal> => config;
