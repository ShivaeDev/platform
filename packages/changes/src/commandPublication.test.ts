import { expect } from "vitest";
import { commandPublication } from "#test/commandPublication.ts";

commandPublication.it("the default command port invalidates the named local subscribers", [], function* ({ announced, publish }) {
	yield* publish(["notes:1"]);

	expect(yield* announced()).toEqual(["notes:1"]);
});

commandPublication.it("the default command port hands the sync token to the host after the keys", [], function* ({ announced, publish }) {
	yield* publish(["notes:1"], { client: "tab-a", id: 3 });

	expect(yield* announced()).toEqual(["notes:1", "sync token 3 of tab-a"]);
});

commandPublication.it("the default command port hands over a sync token that comes with no keys", [], function* ({ announced, publish }) {
	yield* publish([], { client: "tab-a", id: 4 });

	expect(yield* announced()).toEqual(["sync token 4 of tab-a"]);
});
