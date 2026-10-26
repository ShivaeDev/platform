import { expect } from "vitest";
import { host } from "#test/app-host/story.ts";
import { subscriptionConnection } from "#test/app-host/subscriptionConnection.ts";

host.it(
	"aborts on socket close from an explicit node request",
	[subscriptionConnection("node")],
	function* ({ openSubscription, aborted, disconnect }) {
		yield* openSubscription();
		expect(aborted()).toBe(false);
		yield* disconnect();
		expect(aborted()).toBe(true);
	},
);
host.it(
	"finds the node request carried by a srvx Web request",
	[subscriptionConnection("web")],
	function* ({ openSubscription, disconnect, aborted }) {
		yield* openSubscription();
		yield* disconnect();
		expect(aborted()).toBe(true);
	},
);
host.it(
	"ignores normal request completion and aborts on later socket close",
	[subscriptionConnection("completed")],
	function* ({ openSubscription, completeRequest, disconnect, aborted }) {
		yield* openSubscription();
		yield* completeRequest();
		expect(aborted()).toBe(false);
		yield* disconnect();
		expect(aborted()).toBe(true);
	},
);
host.it("aborts immediately for an already destroyed connection", [subscriptionConnection("destroyed")], function* ({ openSubscription, aborted }) {
	yield* openSubscription();
	expect(aborted()).toBe(true);
});
host.it(
	"combines Web and additional abort signals",
	[subscriptionConnection("additional")],
	function* ({ openSubscription, abortProcedure, aborted }) {
		yield* openSubscription();
		abortProcedure();
		expect(aborted()).toBe(true);
	},
);
host.it(
	"disposes node listeners idempotently",
	[subscriptionConnection("node")],
	function* ({ openSubscription, listenerCounts, disposeSubscription, aborted, disconnect }) {
		yield* openSubscription();
		expect(listenerCounts()).toEqual({ request: 1, socket: 1 });
		disposeSubscription();
		disposeSubscription();
		expect(listenerCounts()).toEqual({ request: 0, socket: 0 });
		yield* disconnect();
		expect(aborted()).toBe(false);
	},
);
