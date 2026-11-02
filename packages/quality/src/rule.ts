import type { Effect, FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { configureWith, noOptions, type RuleCheckResult, ruleConfiguration } from "#adapters/rule.ts";
import type { StandardSchemaV1 } from "#adapters/standardSchema.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";

export interface Finding {
	readonly count?: number | undefined;
	readonly file: string;
	readonly line?: number | undefined;
	readonly message: string;
	readonly subject?: string | undefined;
	readonly threshold?: number | undefined;
}

export type Findings = readonly Finding[];

export interface SourceFile {
	readonly lines: readonly string[];
	readonly path: string;
	readonly text: string;
}

export interface RuleInputs {
	readonly configFile?: string;
	readonly exceptions?: readonly ExceptionDeclaration[];
	readonly files: readonly string[];
	readonly readText: (path: string) => Promise<string | undefined>;
	readonly root: string;
	readonly signal?: AbortSignal;
	readonly sources: readonly SourceFile[];
}

export interface RuleContext<TOptions> extends RuleInputs {
	readonly options: TOptions;
}

export type RuleServices = FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner;

export type RuleCheck<TServices = RuleServices> = (inputs: RuleInputs) => Effect.Effect<Findings, unknown, TServices>;

export type Configured<TServices = RuleServices> =
	| { readonly _tag: "Invalid"; readonly issues: readonly string[] }
	| { readonly _tag: "Ready"; readonly check: RuleCheck<TServices> };

export interface RegisteredRule<TServices = RuleServices> {
	readonly description: string;
	readonly family?: boolean;
	readonly id: string;
	readonly registrable?: boolean;
	readonly [ruleConfiguration]: (options: unknown) => Promise<Configured<TServices>>;
}

export interface Rule<TId extends string = string, TInput = unknown, TServices = RuleServices> extends RegisteredRule<TServices> {
	readonly configure: (options: TInput | undefined) => Promise<Configured<TServices>>;
	readonly id: TId;
}

interface RuleDefinition<TId extends string, TOptions, TServices> {
	readonly check: (context: RuleContext<NoInfer<TOptions>>) => RuleCheckResult<TServices>;
	readonly description: string;
	readonly id: TId;
	readonly registrable?: false;
	readonly validate?: (context: RuleContext<NoInfer<TOptions>>) => readonly string[];
}

interface RuleDefinitionWithOptions<TId extends string, TInput, TOptions, TServices> extends RuleDefinition<TId, TOptions, TServices> {
	readonly options: StandardSchemaV1<TInput, TOptions>;
}

interface RuleDefinitionWithoutOptions<TId extends string, TServices> extends RuleDefinition<TId, undefined, TServices> {
	readonly options?: undefined;
}

export function defineRule<const TId extends string, TInput, TOptions, TServices = never>(
	definition: RuleDefinitionWithOptions<TId, TInput, TOptions, TServices>,
): Rule<TId, TInput, TServices>;
export function defineRule<const TId extends string, TServices = never>(
	definition: RuleDefinitionWithoutOptions<TId, TServices>,
): Rule<TId, undefined, TServices>;
export function defineRule<const TId extends string, TInput, TOptions, TServices = never>(
	definition: RuleDefinitionWithOptions<TId, TInput, TOptions, TServices> | RuleDefinitionWithoutOptions<TId, TServices>,
): Rule<TId, TInput, TServices> | Rule<TId, undefined, TServices> {
	const configure =
		definition.options === undefined
			? configureWith(noOptions, definition.check, definition.id, undefined, definition.validate)
			: configureWith(definition.options, definition.check, definition.id, {}, definition.validate);
	return {
		[ruleConfiguration]: configure,
		configure,
		description: definition.description,
		id: definition.id,
		registrable: definition.registrable ?? true,
	};
}
