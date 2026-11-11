import { expect } from "@effect/vitest";
import { sharedErrorClasses } from "#rules/effect/sharedErrorClasses.ts";
import { ruleCases } from "#test/ruleCases.ts";
import { repositoryHas, repositoryLinks } from "#test/ruleStory.ts";
import { sharedErrorFiles } from "#test/sharedErrorFiles.ts";

const repository = ruleCases.repository(
	repositoryHas(...sharedErrorFiles),
	repositoryLinks("node_modules/@shivaedev/errors", "../../packages/errors"),
);

for (const { name, code, className, tag, exported } of [
	{
		className: "TooManyRequests",
		code: 'class TooManyRequests extends Schema.TaggedError<TooManyRequests>()("TooManyRequests", {}) {}',
		exported: "TooManyRequests",
		name: "a Schema tagged error",
		tag: "TooManyRequests",
	},
	{
		className: "RateLimited",
		code: 'class RateLimited extends Data.TaggedError("TooManyRequests") {}',
		exported: "TooManyRequests",
		name: "a Data tagged error with a different class name",
		tag: "TooManyRequests",
	},
	{
		className: "LimitReached",
		code: 'class LimitReached extends Schema.TaggedErrorClass<LimitReached>()("SharedBudget", {}) {}',
		exported: "BudgetExhausted",
		name: "a tagged error class exported under a different class name",
		tag: "SharedBudget",
	},
	{
		className: "Limited",
		code: "class Limited extends SharedRateLimit {}",
		exported: "TooManyRequests",
		name: "a subclass retaining a shared tag",
		tag: "TooManyRequests",
	},
	{
		className: "ManualLimit",
		code: 'class ManualLimit extends Error { readonly _tag = "TooManyRequests"; }',
		exported: "TooManyRequests",
		name: "an Error with an explicit shared tag",
		tag: "TooManyRequests",
	},
	{
		className: "anonymous class",
		code: 'const LocalLimit = class extends Data.TaggedError("TooManyRequests") {};',
		exported: "TooManyRequests",
		name: "an anonymous class expression",
		tag: "TooManyRequests",
	},
]) {
	ruleCases.it(
		`effect/shared-error-classes reports ${name} with its shared import`,
		[
			repository.has({
				content: [
					'import { Schema as S, Data } from "effect";',
					'import { TooManyRequests as SharedRateLimit } from "@shivaedev/errors/taxonomy.ts";',
					"const Schema = S;",
					code,
				].join("\n"),
				path: "src/limit.ts",
			}),
		],
		function* ({ check }) {
			const findings = yield* check(sharedErrorClasses);

			expect(findings).toEqual([
				{
					file: "src/limit.ts",
					line: 4,
					message: `Tagged error ${className} reuses the shared tag "${tag}". Import ${exported} from "@shivaedev/errors/taxonomy.ts" and use that class instead.`,
				},
			]);
		},
	);
}
