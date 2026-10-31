import { expect } from "vitest";
import { policyServerStory, untypedQueries } from "#test/policyServerStory.ts";

policyServerStory.it(
	"a server refuses to start and names every query missing a read policy, including subscription-only queries",
	[untypedQueries],
	function* ({ start }) {
		const answer = yield* start();

		expect(answer).toEqual({
			error: "MissingReadPolicies",
			message: "Declare a readPolicy on queries: archive.list, notes.get, notes.list",
			queries: ["archive.list", "notes.get", "notes.list"],
		});
	},
);

policyServerStory.it("a server whose queries declare read policies starts and serves a note over HTTP", [], function* ({ start, read }) {
	expect(yield* start()).toBe("started");

	const answer = yield* read();

	expect(answer).toBe("A note");
});
