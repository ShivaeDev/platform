import { expect } from "vitest";
import { offline, queryFailureStory } from "#test/queryFailureStory.ts";

queryFailureStory.it("a query exposes its client middleware failure in the declared union", [offline], function* ({ read }) {
	const result = yield* read();

	expect(result).toBe("client is offline");
});

queryFailureStory.it("a query over HTTP exposes its refused subscription in the declared union", [], function* ({ read }) {
	const result = yield* read();

	expect(result).toBe("subscription refused: query-failures.$changes needs the WebSocket protocol");
});
