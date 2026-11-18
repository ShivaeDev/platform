import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { commandPublication, noHostDelivery, throwingSubscriber } from "#test/commandPublication.ts";

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

commandPublication.it(
	"without a host to take it, the default command port publishes the keys and drops the sync token",
	[noHostDelivery()],
	function* ({ announced, publish }) {
		yield* outcomes([
			["publication", () => publish(["notes:1"], { client: "tab-a", id: 5 }), "published"],
			["announced", () => announced(), ["notes:1"]],
		]);
	},
);

commandPublication.it(
	"a subscriber that throws fails the publication with its typed error, and the sync token stays behind",
	[throwingSubscriber("notes:3")],
	function* ({ announced, publish }) {
		yield* outcomes([
			["publication", () => publish(["notes:3"], { client: "tab-a", id: 6 }), "publication failed: Error: The subscriber to notes:3 threw"],
			["announced", () => announced(), []],
		]);
	},
);
