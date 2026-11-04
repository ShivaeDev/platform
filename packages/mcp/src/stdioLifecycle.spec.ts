import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { modernStdioStory, stdioStory } from "#test/stdio/story.ts";

for (const [protocol, kit] of [
	["2025-11-25", stdioStory],
	["2026-07-28", modernStdioStory],
] as const) {
	kit.it(
		`a child process lists and calls its tools over ${protocol}, then exits when the client closes`,
		[],
		function* ({ tools, readResource, close, exitStatus }) {
			yield* outcomes([
				["tool discovery", () => tools(), ["readResource", "holdResource", "resourceState"]],
				["tool result", () => readResource(), "resource contents"],
			]);

			yield* close();

			expect(yield* exitStatus()).toBe("interrupted");
		},
	);
}

stdioStory.it("HTTP and stdio expose the same native toolkit definitions", [], function* ({ httpDefinitions, definitions }) {
	const http = yield* httpDefinitions();

	expect(yield* definitions()).toEqual(http);
});

stdioStory.it(
	"cancelling a stdio call closes its open file and a later call reads the resource",
	[],
	function* ({ startResourceCall, cancelCall, resourceState, readResource }) {
		yield* startResourceCall();
		expect(yield* resourceState(false)).toBe("open");

		yield* cancelCall();

		yield* outcomes([
			["cancelled call closes its file", () => resourceState(true), "closed"],
			["later call reads the resource", () => readResource(), "resource contents"],
		]);
	},
);

stdioStory.it(
	"closing the stdio client interrupts its running tool and closes the tool's file before the server exits",
	[],
	function* ({ startResourceCall, resourceState, close, storedRelease, serverIsRunning, exitStatus }) {
		yield* startResourceCall();
		expect(yield* resourceState(false)).toBe("open");

		yield* close();

		yield* outcomes([
			["tool releases its file", () => storedRelease(), "resource closed"],
			["server stops", () => serverIsRunning(), false],
			["server exits after interruption", () => exitStatus(), "interrupted"],
		]);
	},
);
