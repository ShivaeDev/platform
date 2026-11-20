import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

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

biomeStory.it(
	"quality drops Biome's noDoneCallback for the parameter of a generator test body and keeps it for every done callback",
	[presetInstalled(), repositoryHas(GENERATOR_BODIES)],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported("lint/style/noDoneCallback"), (actual) =>
			actual.toEqual([
				"src/generators.test.ts:4",
				"src/generators.test.ts:5",
				"src/generators.test.ts:6",
				"src/generators.test.ts:7",
				"src/generators.test.ts:8",
			]),
		);
	},
);
