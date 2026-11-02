import { expect } from "@effect/vitest";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";
import { sharedErrorFiles } from "#test/sharedErrorFiles.ts";
import { sharedErrorClasses } from "./sharedErrorClasses.ts";

const sharedErrors = [
	effectResolves(),
	repositoryHas(...sharedErrorFiles),
	repositoryLinks("node_modules/@shivaedev/errors", "../../packages/errors"),
];

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
		code: 'const tag = "SharedBudget"; const tagged = Schema.TaggedError; class LimitReached extends tagged<LimitReached>()(tag, {}) {}',
		exported: "BudgetExhausted",
		name: "an aliased constructor and constant tag exported under a different class name",
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
	ruleStory.it(
		`effect/shared-error-classes reports ${name} with its shared import`,
		[
			...sharedErrors,
			repositoryHas({
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

ruleStory.it(
	"effect/shared-error-classes accepts shared declarations and imports, unique errors, private tags and non-error classes",
	[
		...sharedErrors,
		repositoryHas({
			content: [
				'import * as Data from "effect/Data";',
				'import { TooManyRequests as SharedRateLimit } from "@shivaedev/errors/taxonomy.ts";',
				"export const rejected = new SharedRateLimit();",
				'class TooManyRequests extends Data.TaggedError("RemoteLimit") {}',
				'class PrivateCopy extends Data.TaggedError("PrivateError") {}',
				'class PlainData { readonly _tag = "TooManyRequests"; }',
			].join("\n"),
			path: "src/limit.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(sharedErrorClasses);

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"effect/shared-error-classes discovers shared tags without an errors import in the consumer",
	[
		...sharedErrors,
		repositoryHas({
			content: 'import { Data } from "effect";\nclass LocalLimit extends Data.TaggedError("SharedBudget") {}',
			path: "src/adapters/limit.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(sharedErrorClasses);

		expect(findings).toEqual([
			{
				file: "src/adapters/limit.ts",
				line: 2,
				message:
					'Tagged error LocalLimit reuses the shared tag "SharedBudget". Import BudgetExhausted from "@shivaedev/errors/taxonomy.ts" and use that class instead.',
			},
		]);
	},
);

ruleStory.it(
	"effect/shared-error-classes reads a published declaration export and reports its public import",
	[
		effectResolves(),
		repositoryLinks("node_modules/@shivaedev/errors", "../../packages/errors"),
		repositoryHas(
			{
				content: JSON.stringify({ exports: { ".": "./dist/errors.d.ts", "./package.json": "./package.json" }, name: "@shivaedev/errors" }),
				path: "packages/errors/package.json",
			},
			{
				content: 'export declare class SlowDown extends Error { readonly _tag: "TooManyRequests"; }',
				path: "packages/errors/dist/errors.d.ts",
			},
			{
				content: 'import { Data } from "effect";\nclass LocalLimit extends Data.TaggedError("TooManyRequests") {}',
				path: "src/limit.ts",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(sharedErrorClasses);

		expect(findings).toEqual([
			{
				file: "src/limit.ts",
				line: 2,
				message:
					'Tagged error LocalLimit reuses the shared tag "TooManyRequests". Import SlowDown from "@shivaedev/errors" and use that class instead.',
			},
		]);
	},
);

ruleStory.it(
	"effect/shared-error-classes discovers tags in nested wildcard exports",
	[
		...sharedErrors,
		repositoryHas({
			content: 'import { Data } from "effect";\nclass LocalLimit extends Data.TaggedError("NestedLimit") {}',
			path: "src/limit.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(sharedErrorClasses);

		expect(findings).toEqual([
			{
				file: "src/limit.ts",
				line: 2,
				message:
					'Tagged error LocalLimit reuses the shared tag "NestedLimit". Import SharedLimit from "@shivaedev/errors/server/sharedLimit.ts" and use that class instead.',
			},
		]);
	},
);

ruleStory.it(
	"effect/shared-error-classes requires shared tags even before the repository depends on errors",
	[
		effectResolves(),
		repositoryHas({
			content: 'import { Data } from "effect";\nclass LocalLimit extends Data.TaggedError("TooManyRequests") {}',
			path: "src/limit.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(sharedErrorClasses);

		expect(findings).toEqual([
			{
				file: "src/limit.ts",
				line: 2,
				message:
					'Tagged error LocalLimit reuses the shared tag "TooManyRequests". Import TooManyRequests from "@shivaedev/errors/taxonomy.ts" and use that class instead.',
			},
		]);
	},
);
