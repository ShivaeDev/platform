import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { allowanceUsed, atCapacity, buckets, requestsAtZeroAndNine } from "#test/better-auth/memoryRateLimit.ts";

buckets.it(
	"alice's ten-second window runs from her last allowed request, not her first",
	[requestsAtZeroAndNine],
	function* ({ clockReaches, request }) {
		yield* clockReaches("18 seconds");

		expect(yield* request("alice")).toBe("retry after 1 second");
	},
);

buckets.it("a blocked request does not move alice's window", [requestsAtZeroAndNine], function* ({ clockReaches, request }) {
	yield* clockReaches("18 seconds");
	expect(yield* request("alice")).toBe("retry after 1 second");

	yield* clockReaches("19 seconds");

	expect(yield* request("alice")).toBe("allowed");
});

buckets.it(
	"half a second short of the window, alice is told to retry after a whole second more",
	[requestsAtZeroAndNine],
	function* ({ clockReaches, request }) {
		yield* clockReaches("17500 millis");

		expect(yield* request("alice")).toBe("retry after 2 seconds");
	},
);

buckets.it("alice using up her allowance leaves bob's own allowance untouched", [allowanceUsed("alice", "once per second")], function* ({ request }) {
	yield* outcomes({
		alice: [request("alice", "once per second"), "retry after 1 second"],
		bob: [request("bob", "once per second"), "allowed"],
	});
});

buckets.it(
	"alice's expired one-second bucket does not count against a one-minute rule",
	[allowanceUsed("alice", "once per second")],
	function* ({ clockReaches, request }) {
		expect(yield* request("alice", "once per second")).toBe("retry after 1 second");

		yield* clockReaches("1 second");

		expect(yield* request("alice", "once per minute")).toBe("allowed");
	},
);

buckets.it(
	"closing the scope that owns the buckets forgets alice's used allowance",
	[allowanceUsed("alice", "once per minute")],
	function* ({ closeScope, request }) {
		expect(yield* request("alice", "once per minute")).toBe("retry after 60 seconds");

		yield* closeScope();

		expect(yield* request("alice", "once per minute")).toBe("allowed");
	},
);

buckets.it("past capacity, a new client's bucket evicts the oldest bucket and keeps the newest", [atCapacity], function* ({ request }) {
	expect(yield* request("the oldest client", "once per minute")).toBe("retry after 60 seconds");

	yield* request("a new client", "once per minute");

	yield* outcomes({
		"the newest client": [request("the newest client", "once per minute"), "retry after 60 seconds"],
		"the oldest client": [request("the oldest client", "once per minute"), "allowed"],
	});
});
