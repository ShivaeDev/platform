import type { Context, Effect, FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import type ts from "typescript";
import type { DeclarationFiles } from "#adapters/declaration-files/service.ts";
import { configureWith, noOptions, type RuleCheckResult, ruleConfiguration } from "#adapters/rule.ts";
import type { StandardSchemaV1 } from "#adapters/standardSchema.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import type { FilesystemFailure } from "#inventory/filesystem.ts";

export interface Finding {
	readonly count?: number | undefined;
	readonly file: string;
	readonly fix?: { readonly end: number; readonly replacement: string; readonly start: number } | undefined;
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

export interface TypeScriptProgram {
	readonly checker: ts.TypeChecker;
	readonly program: ts.Program;
	readonly sourceFile: (path: string) => ts.SourceFile | undefined;
	readonly ts: typeof ts;
}

export interface RuleInputs {
	readonly configFile?: string;
	readonly entries?: readonly string[];
	readonly exceptions?: readonly ExceptionDeclaration[];
	readonly files: readonly string[];
	// The folders imports/resolvable declares as generated output, so every rule reads one declaration.
	readonly generated?: readonly string[];
	readonly nonEffectFolders?: readonly string[];
	readonly readText: (path: string) => Effect.Effect<string | undefined, FilesystemFailure>;
	readonly root: string;
	readonly sources: readonly SourceFile[];
	readonly typeScript: Effect.Effect<TypeScriptProgram>;
}

export interface RuleContext<TOptions> extends RuleInputs {
	readonly options: TOptions;
}

export type RuleServices = ChildProcessSpawner.ChildProcessSpawner | Context.Service.Identifier<typeof DeclarationFiles> | FileSystem.FileSystem;

export type RuleCheck<TServices = RuleServices> = (
	inputs: Omit<RuleInputs, "typeScript"> & Partial<Pick<RuleInputs, "typeScript">>,
) => Effect.Effect<Findings, unknown, TServices>;

export interface Halves<TServices = RuleServices> {
	readonly deep: RuleCheck<TServices>;
	readonly fast: RuleCheck<TServices>;
	readonly name: string;
}

export type Configured<TServices = RuleServices> =
	| { readonly _tag: "Invalid"; readonly issues: readonly string[] }
	| { readonly _tag: "Ready"; readonly check: RuleCheck<TServices>; readonly halves?: Halves<TServices> };

export type Depth = "deep";

export type Need = "child-process" | "story-program";

export interface RegisteredRule<TServices = RuleServices> {
	readonly depth?: Depth;
	readonly description: string;
	readonly family?: boolean;
	readonly id: string;
	readonly needs?: Need;
	readonly registrable?: boolean;
	readonly [ruleConfiguration]: (options: unknown) => Promise<Configured<TServices>>;
}

export interface Rule<TId extends string = string, TInput = unknown, TServices = RuleServices> extends RegisteredRule<TServices> {
	readonly configure: (options: TInput | undefined) => Promise<Configured<TServices>>;
	readonly id: TId;
}

type DefinedCheck<TOptions, TServices> = (context: RuleContext<NoInfer<TOptions>>) => RuleCheckResult<TServices>;

interface RuleDefinition<TId extends string, TOptions, TServices> {
	readonly check: DefinedCheck<TOptions, TServices>;
	readonly deepHalf?: { readonly check: DefinedCheck<TOptions, TServices>; readonly name: string };
	readonly depth?: Depth;
	readonly description: string;
	readonly id: TId;
	readonly needs?: Need;
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
			? configureWith(noOptions, definition, definition.id, undefined, definition.validate)
			: configureWith(definition.options, definition, definition.id, {}, definition.validate);
	return {
		[ruleConfiguration]: configure,
		configure,
		...(definition.depth === undefined ? {} : { depth: definition.depth }),
		description: definition.description,
		id: definition.id,
		...(definition.needs === undefined ? {} : { needs: definition.needs }),
		registrable: definition.registrable ?? true,
	};
}
