import type { Bivariant } from "@shivaedev/types/bivariant.ts";
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
	readonly sources: readonly SourceFile[];
}

export interface RuleContext<TOptions> extends RuleInputs {
	readonly options: TOptions;
}

export type Configured =
	| { readonly _tag: "Invalid"; readonly issues: readonly string[] }
	| { readonly _tag: "Ready"; readonly check: (inputs: RuleInputs) => Promise<Findings> };

export interface Rule<TId extends string = string, TInput = unknown> {
	// Bivariance keeps rules with different options in one list; configure validates its input at runtime.
	configure: Bivariant<(options: TInput | undefined) => Promise<Configured>>;
	readonly description: string;
	readonly family?: boolean;
	readonly id: TId;
	readonly registrable?: boolean;
}

interface RuleDefinition<TId extends string, TOptions> {
	readonly check: (context: RuleContext<TOptions>) => Findings | PromiseLike<Findings>;
	readonly description: string;
	readonly id: TId;
	readonly registrable?: false;
}

interface RuleDefinitionWithOptions<TId extends string, TInput, TOptions> extends RuleDefinition<TId, TOptions> {
	readonly options: StandardSchemaV1<TInput, TOptions>;
}

interface RuleDefinitionWithoutOptions<TId extends string> extends RuleDefinition<TId, undefined> {
	readonly options?: undefined;
}

const noOptions: StandardSchemaV1<undefined, undefined> = {
	"~standard": {
		validate: (value) => (value === undefined ? { value: undefined } : { issues: [{ message: "this rule takes no options" }] }),
		vendor: "@shivaedev/quality",
		version: 1,
	},
};

function configureWith<TInput, TOptions>(
	schema: StandardSchemaV1<TInput, TOptions>,
	check: RuleDefinition<string, TOptions>["check"],
	absent: unknown,
) {
	return async (options: unknown): Promise<Configured> => {
		const result = await schema["~standard"].validate(options ?? absent);
		if (result.issues !== undefined) {
			return { _tag: "Invalid", issues: result.issues.map(describeIssue) };
		}
		const value = result.value;
		return { _tag: "Ready", check: async (inputs) => check({ ...inputs, options: value }) };
	};
}

export function defineRule<const TId extends string, TInput, TOptions>(
	definition: RuleDefinitionWithOptions<TId, TInput, TOptions>,
): Rule<TId, TInput>;
export function defineRule<const TId extends string>(definition: RuleDefinitionWithoutOptions<TId>): Rule<TId, undefined>;
export function defineRule<const TId extends string, TInput, TOptions>(
	definition: RuleDefinitionWithOptions<TId, TInput, TOptions> | RuleDefinitionWithoutOptions<TId>,
): Rule<TId, TInput> | Rule<TId, undefined> {
	const configure =
		definition.options === undefined
			? configureWith(noOptions, definition.check, undefined)
			: configureWith(definition.options, definition.check, {});
	return { configure, description: definition.description, id: definition.id, registrable: definition.registrable ?? true };
}
