import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { driverScreen } from "#test/driverScreen.tsx";

expectNoReactWarnings();

driverScreen.it(
	"settling waits for a response that arrives after the click and renders it without an act warning",
	[],
	function* ({ click, respond, settle, text }) {
		yield* click("button");
		expect(text("h1")).toBe("Ready");

		yield* respond("News arrived");
		yield* settle();

		expect(text("h1")).toBe("News arrived");
	},
);

driverScreen.it("entering text updates the controlled React field and the draft it renders", [], function* ({ enter, fieldValue, renderedDraft }) {
	yield* enter("input", "New draft");

	yield* outcomes([
		["field value", () => fieldValue(), "New draft"],
		["rendered draft", () => renderedDraft(), "New draft"],
	]);
});
