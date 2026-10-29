import { readFileSync } from "node:fs";
import { join } from "node:path";
import { linkPackage, seedTree } from "./tree.ts";

export const RECOGNITION_RULES: readonly string[] = [
	"lint/correctness/noComponentHookFactories",
	"lint/nursery/useValidTestTitle",
	"lint/style/noDoneCallback",
];

export const RECOGNITION_ARGS = ["lint", ...RECOGNITION_RULES.map((rule) => `--only=${rule}`)];

const PROBES: Readonly<Record<string, readonly string[]>> = {
	"src/fake-tags.tsx": [
		'import { Effect } from "not-effect";',
		"function backend() { return Effect.catchTags({ SchemaError: () => Effect.fail(new Error()) }); }",
	],
	"src/generators.test.ts": [
		'import { it, beforeEach } from "vitest";',
		'it.effectTRPC("retains caller types", function* (trpc) { yield* trpc.read(); });',
		'it.effectApp("retains app types", function* (app) { yield* app.trpc.read(); });',
		'it.effectTRPC("rejects done", (done) => { done(); });',
		'it("rejects done", function (done) { done(); });',
		"beforeEach((done) => { done(); });",
		"it(42, function* (harness) { yield* harness.read(); });",
		'it("rejects outer done", (done) => { consume(function* (value) { yield value; }); done(); });',
	],
	"src/regex.ts": [
		'import { test } from "vitest";',
		'const marker = "💡é"; /a/u.test(value); test(42, () => {});',
		'(/a/u).test(value); test("", () => {});',
		"test.only(false, () => {});",
	],
	"src/tags.tsx": [
		'import { Effect as Fx } from "effect";',
		'import * as Native from "effect/Effect";',
		'import { catchTags as handleTags, fail as reject } from "effect/Effect";',
		"function backend() { return Fx.catchTags({ SchemaError: () => Fx.fail(new Error()), SqlError: () => Fx.fail(new Error()) }); }",
		"function namespace() { return Native.catchTags({ SchemaError: () => Native.fail(new Error()) }); }",
		"function imported() { return handleTags({ SqlError: () => reject(new Error()) }); }",
		"function factory() { const Inner = () => <div />; return Inner; }",
		"function hookFactory() { function useInner() { return 1; } return useInner; }",
		"function componentTag() { return Fx.catchTags({ SchemaError: () => <div /> }); }",
		"function nestedTag() { return Fx.catchTags({ SqlError: () => { const Inner = () => <div />; return Inner; } }); }",
		"function shadowed(Fx: any) { return Fx.catchTags({ SchemaError: () => Fx.fail(new Error()) }); }",
		"function shadowedFailure() { return Fx.catchTags({ SqlError: (Fx: any) => Fx.fail(new Error()) }); }",
		"function unrelated() { return { SchemaError: () => Fx.fail(new Error()) }; }",
	],
};

export function recognitionTree(): string {
	const root = seedTree(
		[
			{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" },
			{ content: "node_modules/\n", path: ".gitignore" },
		],
		Object.entries(PROBES).map(([path, lines]) => ({ content: `${lines.join("\n")}\n`, path })),
	);
	linkPackage(root);
	return root;
}

export function recognitionSources(root: string): readonly string[] {
	return Object.keys(PROBES).map((path) => readFileSync(join(root, path), "utf8"));
}
