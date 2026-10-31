import { expect } from "vitest";
import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";

const GENERATOR_BODIES = {
	content: [
		'import { it, beforeEach } from "vitest";',
		'it.effectTRPC("retains caller types", function* (trpc) { yield* trpc.read(); });',
		'it.effectApp("retains app types", function* (app) { yield* app.trpc.read(); });',
		'it.effectTRPC("rejects done", (done) => { done(); });',
		'it("rejects done", function (done) { done(); });',
		"beforeEach((done) => { done(); });",
		"it(42, function* (harness) { yield* harness.read(); });",
		'it("rejects outer done", (done) => { consume(function* (value) { yield value; }); done(); });',
	]
		.join("\n")
		.concat("\n"),
	path: "src/generators.test.ts",
};

const TAG_HANDLERS = {
	content: [
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
	]
		.join("\n")
		.concat("\n"),
	path: "src/tags.tsx",
};

const FOREIGN_TAGS = {
	content: [
		'import { Effect } from "not-effect";',
		"function backend() { return Effect.catchTags({ SchemaError: () => Effect.fail(new Error()) }); }",
	]
		.join("\n")
		.concat("\n"),
	path: "src/fake-tags.tsx",
};

biomeStory.it(
	"quality drops Biome's noDoneCallback for the parameter of a generator test body and keeps it for every done callback",
	[presetInstalled(), repositoryHas(GENERATOR_BODIES)],
	function* ({ checks, reported }) {
		yield* checks();

		expect(yield* reported("lint/style/noDoneCallback")).toEqual([
			"src/generators.test.ts:4",
			"src/generators.test.ts:5",
			"src/generators.test.ts:6",
			"src/generators.test.ts:8",
		]);
	},
);

biomeStory.it(
	"quality drops Biome's noComponentHookFactories for catchTags handlers of Effect's own imports that only fail and keeps it for factories, JSX handlers, shadowed Effect names and plain objects",
	[presetInstalled(), repositoryHas(TAG_HANDLERS)],
	function* ({ checks, reported }) {
		yield* checks();

		expect(yield* reported("lint/correctness/noComponentHookFactories")).toEqual([
			"src/tags.tsx:7",
			"src/tags.tsx:8",
			"src/tags.tsx:9",
			"src/tags.tsx:10",
			"src/tags.tsx:10",
			"src/tags.tsx:12",
			"src/tags.tsx:13",
		]);
	},
);

biomeStory.it(
	"quality keeps Biome's noComponentHookFactories for catchTags imported from a package other than effect",
	[presetInstalled(), repositoryHas(FOREIGN_TAGS)],
	function* ({ checks, reported }) {
		yield* checks();

		expect(yield* reported("lint/correctness/noComponentHookFactories")).toEqual(["src/fake-tags.tsx:2"]);
	},
);
