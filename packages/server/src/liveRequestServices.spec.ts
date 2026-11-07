import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { socketPolicyStory } from "#test/socket-policy/story.ts";

socketPolicyStory.it(
	"a live query's request service sees the new session role after a change hint",
	[],
	function* ({ createList, nextHint, pushedRole, revokeAdmin, save, subscribe }) {
		yield* createList(1, "alice");
		yield* subscribe("admin", "role");
		expect(yield* pushedRole()).toEqual({ callerRole: "admin", capturedRole: "admin", role: "admin" });
		yield* revokeAdmin();

		yield* save(1, 1, "Changed");

		yield* outcomes([
			["pushed rerun", () => nextHint("role"), "result"],
			["current role throughout the handler", () => pushedRole(), { callerRole: "reader", capturedRole: "reader", role: "reader" }],
		]);
	},
);
