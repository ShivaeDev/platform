import { expect } from "vitest";
import { host } from "#test/app-host/story.ts";
import { subscriptionConnection } from "#test/app-host/subscriptionConnection.ts";

for (const [request, mode] of [
	["an explicit node request", "node"],
	["the node request carried by a srvx Web request", "web"],
] as const) {
	host.it(
		`a subscription on ${request} aborts when the client's socket closes`,
		[subscriptionConnection(mode)],
		function* ({ disconnect, openSubscription, subscriptionSignal }) {
			yield* openSubscription();
			expect(yield* subscriptionSignal()).toBe("open");

			yield* disconnect();

			expect(yield* subscriptionSignal()).toBe("aborted");
		},
	);
}

host.it(
	"a subscription stays open when the client finishes its request body",
	[subscriptionConnection("completed")],
	function* ({ completeRequest, openSubscription, subscriptionSignal }) {
		yield* openSubscription();

		yield* completeRequest();

		expect(yield* subscriptionSignal()).toBe("open");
	},
);

host.it(
	"a subscription with a finished request body aborts when the socket later closes",
	[subscriptionConnection("completed")],
	function* ({ completeRequest, disconnect, openSubscription, subscriptionSignal }) {
		yield* openSubscription();
		yield* completeRequest();

		yield* disconnect();

		expect(yield* subscriptionSignal()).toBe("aborted");
	},
);

host.it(
	"a subscription on an already destroyed connection starts aborted",
	[subscriptionConnection("destroyed")],
	function* ({ openSubscription, subscriptionSignal }) {
		yield* openSubscription();

		expect(yield* subscriptionSignal()).toBe("aborted");
	},
);

host.it(
	"an additional abort signal aborts the Web request's subscription",
	[subscriptionConnection("additional")],
	function* ({ abortProcedure, openSubscription, subscriptionSignal }) {
		yield* openSubscription();
		expect(yield* subscriptionSignal()).toBe("open");

		yield* abortProcedure();

		expect(yield* subscriptionSignal()).toBe("aborted");
	},
);

host.it(
	"disposing a subscription twice removes its request and socket close listeners once",
	[subscriptionConnection("node")],
	function* ({ closeListeners, disposeSubscription, openSubscription }) {
		yield* openSubscription();
		expect(yield* closeListeners()).toEqual({ request: 1, socket: 1 });

		yield* disposeSubscription();
		yield* disposeSubscription();

		expect(yield* closeListeners()).toEqual({ request: 0, socket: 0 });
	},
);

host.it(
	"a disposed subscription stays open when the socket later closes",
	[subscriptionConnection("node")],
	function* ({ disconnect, disposeSubscription, openSubscription, subscriptionSignal }) {
		yield* openSubscription();
		yield* disposeSubscription();

		yield* disconnect();

		expect(yield* subscriptionSignal()).toBe("open");
	},
);
