import { expect } from "@effect/vitest";
import { sharedErrorClasses } from "#rules/effect/sharedErrorClasses.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";
import { sharedErrorFiles } from "#test/sharedErrorFiles.ts";

const sharedErrors = [
	effectResolves(),
	repositoryHas(...sharedErrorFiles),
	repositoryLinks("node_modules/@shivaedev/errors", "../../packages/errors"),
];

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
