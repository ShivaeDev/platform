import { expect } from "vitest";
import { archiveRegressions, missingFile, missingSharedPeer, packedFile } from "#package-check/test-support/archiveRegressions.ts";

archiveRegressions.it("accepts the intact packed fixture", [], function* ({ check }) {
	expect(yield* check()).toBeUndefined();
});

archiveRegressions.it("rejects a missing shared Effect peer", [missingSharedPeer], function* ({ check }) {
	expect(yield* check()).toContain("archive-probe: executable needs @effect/platform-node-shared as an exact peer at 4.0.0");
});

archiveRegressions.it("rejects a missing import target", [missingFile("dist/error.js")], function* ({ check }) {
	expect(yield* check()).toContain("dist/cli.js imports #error, whose target ./dist/error.js is not packed");
});

archiveRegressions.it("rejects a missing manifest target", [missingFile("dist/library.js")], function* ({ check }) {
	expect(yield* check()).toContain("archive-probe: missing manifest target ./dist/library.js");
});

archiveRegressions.it("rejects a packed test file", [packedFile("dist/probe.test.js", "export {};\n")], function* ({ check }) {
	expect(yield* check()).toContain("packed test file package/dist/probe.test.js");
});

archiveRegressions.it(
	"rejects a source map with a missing source",
	[packedFile("dist/error.js.map", JSON.stringify({ sources: ["../src/missing.ts"], version: 3 }))],
	function* ({ check }) {
		expect(yield* check()).toContain("package/dist/error.js.map references missing package/src/missing.ts");
	},
);
