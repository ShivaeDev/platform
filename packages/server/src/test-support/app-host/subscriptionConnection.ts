import { IncomingMessage } from "node:http";
import { toIncomingMessage } from "@effect/platform-node/NodeHttpServerRequest";
import { Effect, Stream } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { host } from "./story.ts";
import { type SubscriptionState, subscribe } from "./subscription.ts";

export function subscriptionConnection(mode: SubscriptionState["mode"]) {
	return host.trait("configured", `a real HTTP subscription uses ${mode} cancellation`, (state) => {
		const connection: SubscriptionState = { baseline: { request: 0, socket: 0 }, mode, procedure: new AbortController(), ready: () => undefined };
		state.subscription = connection;
		state.routes = HttpRouter.add("POST", "/subscription", (incoming) =>
			Effect.gen(function* () {
				if (mode === "completed") {
					yield* incoming.text;
				}
				const node = toIncomingMessage(incoming);
				if (!(node instanceof IncomingMessage)) {
					return yield* Effect.die(new Error("The subscription fixture requires an HTTP/1.1 request"));
				}
				connection.subscription = subscribe(connection, node);
				connection.ready();
				return HttpServerResponse.stream(Stream.make(new TextEncoder().encode("ready")).pipe(Stream.concat(Stream.never)));
			}),
		);
		state.cleanup.push(() => {
			connection.subscription?.dispose();
			connection.outgoing?.destroy();
		});
	});
}
