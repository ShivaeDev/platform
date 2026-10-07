import { Effect, PubSub, Ref, Stream } from "effect";
import { Sse } from "effect/unstable/encoding";
import { HttpServerResponse } from "effect/unstable/http";
import type { Change, Changes } from "#files/changes.ts";
import { HEADERS } from "./respond.ts";

function event(name: string, data = ""): Sse.Event {
	return { _tag: "Event", data, event: name, id: undefined };
}

function watching(up: boolean): Sse.Event {
	return event(up ? "ready" : "down");
}

function eventOf(change: Change): Sse.Event {
	return change._tag === "Changed" ? event("change", JSON.stringify({ paths: change.paths })) : watching(change.watching);
}

function subscribed(changes: Changes) {
	return Stream.unwrap(
		Effect.gen(function* () {
			const subscription = yield* PubSub.subscribe(changes.events);
			const now = yield* Ref.get(changes.watching);
			return Stream.concat(Stream.succeed(watching(now)), Stream.map(Stream.fromSubscription(subscription), eventOf));
		}),
	);
}

export const events = (changes: Changes) => () =>
	Effect.succeed(
		HttpServerResponse.stream(Stream.encodeText(Stream.map(subscribed(changes), (message) => Sse.encoder.write(message))), {
			contentType: "text/event-stream",
			headers: HEADERS,
		}),
	);
