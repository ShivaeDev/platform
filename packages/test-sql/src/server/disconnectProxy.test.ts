import { expect } from "vitest";
import { connected, proxy } from "#test/disconnectProxy.ts";

proxy.it("disconnecting cuts an established PostgreSQL connection", [connected], function* ({ disconnect, query }) {
	expect(yield* query()).toEqual([[42]]);

	yield* disconnect();

	expect(yield* query()).toBe("connection failed");
});

proxy.it("refusing rejects a new PostgreSQL connection", [], function* ({ refuse, query }) {
	yield* refuse();

	expect(yield* query()).toBe("connection failed");
});

proxy.it("closing the proxy scope disconnects its client and closes its listener", [], function* ({ close, query }) {
	expect(yield* query()).toEqual([[42]]);

	yield* close();

	expect(yield* query()).toBe("connection failed");
});

proxy.it(
	"stalling withholds a PostgreSQL answer until traffic resumes",
	[connected],
	function* ({ stall, resume, query, startQuery, queryBeforeDeadline, queryAnswer }) {
		expect(yield* query()).toEqual([[42]]);

		yield* stall();
		yield* startQuery();

		expect(yield* queryBeforeDeadline()).toBe("waiting");

		yield* resume();

		expect(yield* queryAnswer()).toEqual([[42]]);
	},
);
