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
				connection.subscription = subscribe(connection, toIncomingMessage(incoming));
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
