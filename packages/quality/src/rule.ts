import { describeIssue, type StandardSchemaV1 } from "./standard-schema.ts";

export interface Finding {
	readonly file: string;
	readonly line?: number | undefined;
	readonly message: string;
	/** Tells apart exceptions of one rule in one file, such as which Biome rule an override turns off. */
	readonly subject?: string | undefined;
	/** A size where larger is worse, such as a file's line count. A baselined file may not grow past it. */
	readonly measure?: number | undefined;
}

export type Findings = ReadonlyArray<Finding>;

export interface SourceFile {
	readonly path: string;
	readonly text: string;
	readonly lines: ReadonlyArray<string>;
}

export interface RuleInputs {
	readonly root: string;
	readonly files: ReadonlyArray<string>;
	readonly sources: ReadonlyArray<SourceFile>;
	readonly readText: (path: string) => Promise<string | undefined>;
}

export interface RuleContext<Options> extends RuleInputs {
	readonly options: Options;
}

export type Configured =
	| { readonly _tag: "Invalid"; readonly issues: ReadonlyArray<string> }
	| { readonly _tag: "Ready"; readonly check: (inputs: RuleInputs) => Promise<Findings> };

export interface Rule<Id extends string = string, Input = unknown> {
	readonly id: Id;
	readonly description: string;
	// Method syntax keeps rules with different options in one list; configure validates its input at runtime.
	configure(options: Input | undefined): Promise<Configured>;
}

interface RuleDefinition<Id extends string, Options> {
	readonly id: Id;
	readonly description: string;
	readonly check: (context: RuleContext<Options>) => Findings | PromiseLike<Findings>;
}

interface RuleDefinitionWithOptions<Id extends string, Input, Options> extends RuleDefinition<Id, Options> {
	readonly options: StandardSchemaV1<Input, Options>;
}

interface RuleDefinitionWithoutOptions<Id extends string> extends RuleDefinition<Id, undefined> {
	readonly options?: undefined;
}

const noOptions: StandardSchemaV1<undefined, undefined> = {
	"~standard": {
		validate: (value) => (value === undefined ? { value: undefined } : { issues: [{ message: "this rule takes no options" }] }),
		vendor: "@shivaedev/quality",
		version: 1,
	},
};

const configureWith =
	<Input, Options>(schema: StandardSchemaV1<Input, Options>, check: RuleDefinition<string, Options>["check"], absent: unknown) =>
	async (options: unknown): Promise<Configured> => {
		const result = await schema["~standard"].validate(options ?? absent);
		if (result.issues !== undefined) {
			return { _tag: "Invalid", issues: result.issues.map(describeIssue) };
		}
		const value = result.value;
		return { _tag: "Ready", check: async (inputs) => check({ ...inputs, options: value }) };
	};

/**
 * Defines a rule. Options are an object validated by a Standard Schema; a rule the config gives no options validates `{}`,
 * so give each option a default or make it optional.
 */
export function defineRule<const Id extends string, Input, Options>(definition: RuleDefinitionWithOptions<Id, Input, Options>): Rule<Id, Input>;
export function defineRule<const Id extends string>(definition: RuleDefinitionWithoutOptions<Id>): Rule<Id, undefined>;
export function defineRule<const Id extends string, Input, Options>(
	definition: RuleDefinitionWithOptions<Id, Input, Options> | RuleDefinitionWithoutOptions<Id>,
): Rule<Id, Input> | Rule<Id, undefined> {
	const configure =
		definition.options === undefined
			? configureWith(noOptions, definition.check, undefined)
			: configureWith(definition.options, definition.check, {});
	return { configure, description: definition.description, id: definition.id };
}
