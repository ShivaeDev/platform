import { expect } from "vitest";
import { offline, queryFailureStory } from "#test/queryFailureStory.ts";

queryFailureStory.it("an ordinary query exposes its client middleware failure in the declared union", [offline], function* ({ read }) {
	const result = yield* read("ordinary");

	expect(result).toBe("client is offline");
});

queryFailureStory.it("a live query over HTTP exposes its subscription failure in the declared union", [], function* ({ read }) {
	const result = yield* read("live");

	expect(result).toBe("subscription refused: query-failures.$changes needs the WebSocket protocol");
});
