import { Effect } from "effect";
import { DeclarationFiles } from "#adapters/declaration-files/service.ts";
import { describeIssue, type StandardSchemaV1 } from "#adapters/standardSchema.ts";
import { typeScriptProgram } from "#adapters/typeScriptProgram.ts";
import { validOrFail } from "#decoded.ts";
import type { Configured, Findings, RegisteredRule, RuleCheck, RuleContext } from "#rule.ts";

export type RuleCheckResult<TServices> = Findings | Effect.Effect<Findings, unknown, TServices>;

export const ruleConfiguration = Symbol("@shivaedev/quality/ruleConfiguration");

export const noOptions: StandardSchemaV1<undefined, undefined> = {
	"~standard": {
		validate: (value) => (value === undefined ? { value: undefined } : { issues: [{ message: "this rule takes no options" }] }),
		vendor: "@shivaedev/quality",
		version: 1,
	},
};

export function configureRegistered<TServices>(rule: RegisteredRule<TServices>, options: unknown): Promise<Configured<TServices>> {
	return rule[ruleConfiguration](options);
}

type ContextCheck<TOptions, TServices> = (context: RuleContext<TOptions>) => RuleCheckResult<TServices>;

export function configureWith<TInput, TOptions, TServices>(
	schema: StandardSchemaV1<TInput, TOptions>,
	checks: {
		readonly check: ContextCheck<TOptions, TServices>;
		readonly deepHalf?: { readonly check: ContextCheck<TOptions, TServices>; readonly name: string } | undefined;
	},
	id: string,
	absent: unknown,
	validate?: (context: RuleContext<TOptions>) => readonly string[],
) {
	return async (options: unknown): Promise<Configured<TServices>> => {
		const result = await schema["~standard"].validate(options ?? absent);
		if (result.issues !== undefined) {
			return { _tag: "Invalid", issues: result.issues.map(describeIssue) };
		}
		const value = result.value;
		function ready(check: ContextCheck<TOptions, TServices>): RuleCheck<TServices> {
			return (inputs) =>
				Effect.scoped(
					Effect.gen(function* () {
						const context = {
							...inputs,
							options: value,
							typeScript: inputs.typeScript ?? (yield* typeScriptProgram(inputs.root, inputs.sources).pipe(Effect.provide(DeclarationFiles.layer))),
						};
						const issues = validate?.(context).map((issue) => `rules.${id}.options: ${issue}`) ?? [];
						yield* validOrFail(
							inputs.configFile ?? "quality.config.ts",
							issues.length === 0 ? { _tag: "Valid", value: undefined } : { _tag: "Invalid", issues },
						);
						const checked = check(context);
						return Effect.isEffect(checked) ? yield* checked : checked;
					}),
				);
		}
		const fast = ready(checks.check);
		if (checks.deepHalf === undefined) {
			return { _tag: "Ready", check: fast };
		}
		const deep = ready(checks.deepHalf.check);
		return {
			_tag: "Ready",
			check: (inputs) =>
				Effect.map(Effect.all([fast(inputs), deep(inputs)]), ([found, typed]) =>
					[...found, ...typed].sort((left, right) => left.file.localeCompare(right.file) || (left.line ?? 0) - (right.line ?? 0)),
				),
			halves: { deep, fast, name: checks.deepHalf.name },
		};
	};
}
