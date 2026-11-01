import { expect } from "vitest";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it("collects and runs the core kit without optional engine imports or Effect's root barrel", [], function* ({ results, run }) {
	yield* run("coreImportStories", { guardImports: true });

	expect(yield* results()).toEqual(["Counter Story: runs without optional engines []: passed"]);
});

storyRunner.it("collects unused React, browser, DOM and OTLP entry points without their engines", [], function* ({ results, run }) {
	yield* run("optionalImportStories", { guardImports: true });

	expect(yield* results()).toEqual(["Integrations Story: collects unused integrations []: passed"]);
});
