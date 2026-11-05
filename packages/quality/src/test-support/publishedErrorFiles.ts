import type { SeedFile } from "@shivaedev/test-kits/quality/adapters/tree.ts";

export const publishedErrorFiles: readonly SeedFile[] = [
	{
		content: JSON.stringify({
			exports: {
				".": { default: "./dist/index.js", types: "./dist/index.d.ts" },
				"./source.ts": "./src/error.ts",
				"./taxonomy.ts": { default: "./dist/taxonomy.js", types: "./dist/taxonomy.d.ts" },
			},
			name: "@shivaedev/errors",
			type: "module",
		}),
		path: "node_modules/@shivaedev/errors/package.json",
	},
	{
		content: [
			'import { Schema as S } from "effect";',
			'declare const ServiceUnavailable_base: S.Class<ServiceUnavailable, S.TaggedStruct<"ServiceUnavailable", { message: S.String }>, import("effect/Cause").YieldableError>;',
			"export declare class ServiceUnavailable extends ServiceUnavailable_base {}",
			"export declare class DeliveryService { deliver(): void; }",
		].join("\n"),
		path: "node_modules/@shivaedev/errors/dist/taxonomy.d.ts",
	},
	{
		content: 'export { ServiceUnavailable, DeliveryService } from "./taxonomy.js";',
		path: "node_modules/@shivaedev/errors/dist/index.d.ts",
	},
	{
		content: 'export { ServiceUnavailable, DeliveryService } from "./taxonomy.js";',
		path: "node_modules/@shivaedev/errors/dist/index.js",
	},
	{
		content: [
			'import { Schema } from "effect";',
			'export class ServiceUnavailable extends Schema.TaggedError()("ServiceUnavailable", { message: Schema.String }) {}',
			"export class DeliveryService { deliver() {} }",
		].join("\n"),
		path: "node_modules/@shivaedev/errors/dist/taxonomy.js",
	},
	{
		content: [
			'import { TaggedError } from "effect/Schema";',
			'export class ServiceUnavailable extends TaggedError<ServiceUnavailable>()("ServiceUnavailable", {}) {}',
		].join("\n"),
		path: "node_modules/@shivaedev/errors/src/error.ts",
	},
];

export function publishedErrorStory(imports: string, body: string): SeedFile {
	return {
		content: [
			'import { app } from "#test/index.ts";',
			imports,
			'app.it("reports a failed delivery", [], function* ({ deliver }) {',
			`yield* deliver(${body});`,
			"});",
		].join("\n"),
		path: "src/delivery.spec.ts",
	};
}
