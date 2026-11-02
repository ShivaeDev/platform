import { Effect } from "effect";
import { validOrFail } from "#decoded.ts";
import type { Configured, Findings, RegisteredRule, RuleContext } from "#rule.ts";
import { describeIssue, type StandardSchemaV1 } from "./standardSchema.ts";

export type RuleCheckResult<TServices> = Findings | PromiseLike<Findings> | Effect.Effect<Findings, unknown, TServices>;

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

export function configureWith<TInput, TOptions, TServices>(
	schema: StandardSchemaV1<TInput, TOptions>,
	check: (context: RuleContext<TOptions>) => RuleCheckResult<TServices>,
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
		return {
			_tag: "Ready",
			check: (inputs) =>
				Effect.scoped(
					Effect.gen(function* () {
						const context = { ...inputs, options: value };
						const issues = validate?.(context).map((issue) => `rules.${id}.options: ${issue}`) ?? [];
						yield* validOrFail(
							inputs.configFile ?? "quality.config.ts",
							issues.length === 0 ? { _tag: "Valid", value: undefined } : { _tag: "Invalid", issues },
						);
						const signal = yield* Effect.abortSignal;
						const checked = check({ ...inputs, options: value, signal });
						return yield* Effect.isEffect(checked) ? checked : Effect.promise(() => Promise.resolve(checked));
					}),
				),
		};
	};
}
