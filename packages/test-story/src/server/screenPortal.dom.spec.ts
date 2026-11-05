import { expect } from "@effect/vitest";
import { portalScreen } from "#test/portalScreen.tsx";

portalScreen.it("settling at the app root waits for delayed content in a body portal sheet", [], function* ({ click, deliver, startSettling, text }) {
	expect(text({ name: "News sheet", role: "dialog" })).toBe("Ready");

	yield* click({ name: "Load news", role: "button" });
	const settled = yield* startSettling();
	yield* deliver("Today's news");
	yield* settled;

	expect(text({ name: "News sheet", role: "dialog" })).toBe("Today's news");
});
