import type { SeedFile } from "@shivaedev/test-kits/quality/adapters/tree.ts";

export const sharedErrorFiles: readonly SeedFile[] = [
	{
		content: JSON.stringify({
			exports: { "./*.ts": { "@shivaedev/source": "./src/*.ts", types: "./dist/*.d.ts" }, "./package.json": "./package.json" },
			name: "@shivaedev/errors",
			type: "module",
		}),
		path: "packages/errors/package.json",
	},
	{
		content: [
			'import { Schema } from "effect";',
			'export class TooManyRequests extends Schema.TaggedError<TooManyRequests>()("TooManyRequests", {}) {}',
			'export class BudgetExhausted extends Schema.TaggedError<BudgetExhausted>()("SharedBudget", {}) {}',
			'class PrivateError extends Schema.TaggedError<PrivateError>()("PrivateError", {}) {}',
		].join("\n"),
		path: "packages/errors/src/taxonomy.ts",
	},
	{
		content: 'import { Data } from "effect"; export class SharedLimit extends Data.TaggedError("NestedLimit") {}',
		path: "packages/errors/src/server/sharedLimit.ts",
	},
];
