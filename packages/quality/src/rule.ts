import { Effect, type FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import type { Bivariant } from "@shivaedev/types/Bivariant.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { describeIssue, type StandardSchemaV1 } from "./standardSchema.ts";

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

export interface Rule<TId extends string = string, TInput = unknown, TServices = RuleServices> {
	// Bivariance keeps rules with different options in one list; configure validates its input at runtime.
	configure: Bivariant<(options: TInput | undefined) => Promise<Configured<TServices>>>;
	readonly description: string;
	readonly family?: boolean;
	readonly id: TId;
	readonly registrable?: boolean;
}

interface RuleDefinition<TId extends string, TOptions, TServices> {
	readonly check: (context: RuleContext<TOptions>) => Findings | PromiseLike<Findings> | Effect.Effect<Findings, unknown, TServices>;
	readonly description: string;
	readonly id: TId;
	readonly registrable?: false;
}

interface RuleDefinitionWithOptions<TId extends string, TInput, TOptions, TServices> extends RuleDefinition<TId, TOptions, TServices> {
	readonly options: StandardSchemaV1<TInput, TOptions>;
}

interface RuleDefinitionWithoutOptions<TId extends string, TServices> extends RuleDefinition<TId, undefined, TServices> {
	readonly options?: undefined;
}

const noOptions: StandardSchemaV1<undefined, undefined> = {
	"~standard": {
		validate: (value) => (value === undefined ? { value: undefined } : { issues: [{ message: "this rule takes no options" }] }),
		vendor: "@shivaedev/quality",
		version: 1,
	},
};

function configureWith<TInput, TOptions, TServices>(
	schema: StandardSchemaV1<TInput, TOptions>,
	check: RuleDefinition<string, TOptions, TServices>["check"],
	absent: unknown,
) {
	return async (options: unknown): Promise<Configured<TServices>> => {
		const result = await schema["~standard"].validate(options ?? absent);
		if (result.issues !== undefined) {
			return { _tag: "Invalid", issues: result.issues.map(describeIssue) };
		}
		const value = result.value;
		return {
			_tag: "Ready",
			check: (inputs) =>
				Effect.scoped(
					Effect.gen(function* () {
						const signal = yield* Effect.abortSignal;
						const checked = check({ ...inputs, options: value, signal });
						return yield* Effect.isEffect(checked) ? checked : Effect.promise(() => Promise.resolve(checked));
					}),
				),
		};
	};
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
			? configureWith(noOptions, definition.check, undefined)
			: configureWith(definition.options, definition.check, {});
	return { configure, description: definition.description, id: definition.id, registrable: definition.registrable ?? true };
}
