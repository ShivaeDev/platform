import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import type { Rule } from "#rule.ts";
import type { builtInRules } from "#rules/builtIn.ts";

export type Level = "error";

export type RuleSetting<TInput> = "error" | { readonly level?: "error"; readonly options?: TInput };

type InputOf<TCandidate> = TCandidate extends Rule<string, infer TInput, unknown> ? TInput : never;

export type RuleSettings<TRules extends readonly Rule<string, unknown, unknown>[]> = {
	readonly [TCandidate in TRules[number] as TCandidate["id"]]?: RuleSetting<InputOf<TCandidate>>;
};

export type BuiltInRules = typeof builtInRules;

export interface QualityConfig<TLocal extends readonly Rule<string, unknown, unknown>[] = readonly Rule<string, unknown, unknown>[]> {
	readonly baseline?: string;
	readonly exceptions?: readonly ExceptionDeclaration[];
	readonly extensions?: readonly string[];
	readonly local?: TLocal;
	readonly registry?: string;
	readonly rules?: RuleSettings<readonly [...BuiltInRules, ...TLocal]>;
	readonly sources?: readonly string[];
}

export function defineConfig<const TLocal extends readonly Rule<string, unknown, unknown>[] = readonly []>(
	config: QualityConfig<TLocal>,
): QualityConfig<TLocal> {
	return config;
}
