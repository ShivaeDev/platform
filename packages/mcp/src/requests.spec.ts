import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { requestsStory } from "#test/requests/story.ts";

requestsStory.it(
	"overlapping alice and bob calls retain their own Identity and SessionUser before and after waiting",
	[],
	function* ({ startCaller, resumeCallers, callerAnswer }) {
		yield* startCaller("alice");
		yield* startCaller("bob");

		yield* resumeCallers();

		for (const name of ["alice", "bob"] as const) {
			const caller = { identity: name, user: { email: `${name}@mcp.test`, id: name, name, role: "user" } };
			expect(yield* callerAnswer(name)).toEqual({ after: caller, before: caller });
		}
	},
);

requestsStory.it(
	"aborting a tool call closes its open file and a later call reads the resource",
	[],
	function* ({ startResourceCall, abortResourceCall, resourceState, resourceReleased, readResource }) {
		yield* startResourceCall();
		expect(yield* resourceState()).toBe("open");

		yield* abortResourceCall();
		yield* resourceReleased();

		yield* outcomes([
			["aborted call closes its file", () => resourceState(), "closed"],
			["later call reads the resource", () => readResource(), "resource contents"],
		]);
	},
);

requestsStory.it("two servers discover and dispatch only their own tools", [], function* ({ toolsOn, callOn }) {
	yield* outcomes([
		["first server discovery", () => toolsOn("first"), ["caller", "readResource", "firstOnly"]],
		["second server discovery", () => toolsOn("second"), ["secondOnly"]],
		["first server dispatch", () => callOn("first", "firstOnly"), "first server"],
		["second server dispatch", () => callOn("second", "secondOnly"), "second server"],
		["first server refuses second tool", () => callOn("first", "secondOnly"), "refused: Tool 'secondOnly' not found"],
		["second server refuses first tool", () => callOn("second", "firstOnly"), "refused: Tool 'firstOnly' not found"],
	]);
});
