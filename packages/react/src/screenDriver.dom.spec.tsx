import { expect } from "vitest";
import { expectNoReactWarnings } from "#client/testing.ts";
import { driverScreen } from "#test/driverScreen.tsx";

expectNoReactWarnings();

driverScreen.it("settles native pending state and flushes the rendered response inside act", [], function* ({ click, deliverTitle, settle, text }) {
	yield* click("button");
	expect(text("h1")).toBe("Ready");
	yield* deliverTitle("News arrived");
	yield* settle();
	expect(text("h1")).toBe("News arrived");
});

driverScreen.it("enters text through the controlled React field", [], function* ({ enter, settle, text, value }) {
	yield* enter("input", "New draft");
	yield* settle();
	expect(value("input")).toBe("New draft");
	expect(text("output")).toBe("New draft");
});
