import { expect } from "vitest";
import { generatedArchive, generatedFileRemoved } from "#package-check/test-support/generatedArchive.ts";

generatedArchive.it("accepts an archive whose generated files equal a fresh generate run on its packed sources", [], function* ({ check }) {
	expect(yield* check()).toBeUndefined();
});

generatedArchive.it(
	"rejects an archive whose generated file was removed, naming the package and the file",
	[generatedFileRemoved],
	function* ({ check }) {
		expect(yield* check()).toContain(
			"generated-probe: the packed generated files differ from a fresh generate run on the packed sources:\nsrc/generated/notes.ts is missing",
		);
	},
);
