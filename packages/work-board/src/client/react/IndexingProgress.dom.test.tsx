import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { indexingBarScreen } from "#test/indexingBarScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

screenStory.it("The indexing bar disappears once the server has finished indexing", [indexingBarScreen()], function* ({ indexingBar }) {
	expect(yield* indexingBar()).toBe("none");
});

screenStory.it(
	"The indexing bar says it is reading the workspace before the file count is known",
	[indexingBarScreen({ read: 0 })],
	function* ({ indexingBar }) {
		expect(yield* indexingBar()).toEqual({ label: "Reading the workspace…", value: "unknown" });
	},
);

screenStory.it(
	"The indexing bar counts the files read with thousands separators",
	[indexingBarScreen({ read: 1240, total: 3936 })],
	function* ({ indexingBar }) {
		expect(yield* indexingBar()).toEqual({ label: "Reading 1,240 of 3,936 files…", value: expect.closeTo((1240 / 3936) * 100) });
	},
);
