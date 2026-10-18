import { Effect } from "effect";
import { vi } from "vitest";
import { board as metadata } from "@shivaedev/work-board/server/integration/board.ts";
import { host } from "#test/hostStory.ts";

export const countBriefParses = host.trait("observation", "observe brief parses after the daemon starts", function* (engine) {
	const parse = vi.spyOn(metadata, "metadataParse");
	yield* Effect.addFinalizer(() => Effect.sync(() => parse.mockRestore()));
	engine.briefParseCount = () => parse.mock.calls.length;
});

export const movingMain = host.trait("configuration", "main can move between admission and launch", (engine) => {
	engine.main = { observedAt: 1, revision: "main-0" };
});
