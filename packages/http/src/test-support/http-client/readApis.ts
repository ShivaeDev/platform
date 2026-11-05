import { Deferred, Effect, Fiber, Layer, Logger, References, Schema, Tracer } from "effect";
import { HttpClient } from "effect/http";
import type { FakeHttpHold } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { optionalField } from "#optionalField.ts";
import { makeReadClient } from "#readClient.ts";
import { createClientEngine } from "./engine.ts";

const Food = Schema.Struct({ energy: optionalField(Schema.Number), name: Schema.String });

export const readApis = storyKit({
	clock: "test",
	*create() {
		const engine = yield* createClientEngine();
		engine.replies.body = { body: { name: "paper" } };
		const logs: unknown[] = [];
		const spans: Tracer.NativeSpan[] = [];
		const recording = Layer.mergeAll(
			Logger.layer([
				Logger.make(({ fiber, message, cause }) => {
					logs.push({ annotations: fiber.getRef(References.CurrentLogAnnotations), cause, message });
				}),
			]),
			Layer.succeed(References.MinimumLogLevel, "All"),
			Layer.succeed(
				Tracer.Tracer,
				Tracer.make({
					span: (options) => {
						const span = new Tracer.NativeSpan(options);
						spans.push(span);
						return span;
					},
				}),
			),
		);
		const clients = yield* Effect.forEach(["food", "usda"], (source) =>
			makeReadClient({ bodyLimit: 64, capacity: 2, schema: Food, source, timeout: "5 seconds", timeToLive: "1 minute" }).pipe(
				Effect.provideService(HttpClient.HttpClient, engine.rawClient()),
				Effect.provide(recording),
			),
		);
		const pending: {
			answer?: typeof Food.Type | string;
			hold?: FakeHttpHold;
			phase?: "headers" | "body";
			read?: Fiber.Fiber<typeof Food.Type | string>;
		} = {};
		return { ...engine, clients, logs, pending, spans };
	},
	name: "outside read APIs",
	stages: ["routes"],
	verbs: ({ clients, lifecycle, logs, pending, remote, spans }, story) => {
		remote.narrate(story.tell);
		function read(source: "food" | "usda" = "food", query = "private search") {
			story.tell(`${source} searches for ${query}`);
			const client = clients[source === "food" ? 0 : 1];
			if (client === undefined) {
				return Effect.die("No read client was built");
			}
			return client.get(`${remote.url}/body?q=${encodeURIComponent(query)}`).pipe(
				Effect.catchTag("ReadClientError", (error) =>
					Effect.succeed(`${error.source}: ${error.reason}${error.status === undefined ? "" : ` ${error.status}`}`),
				),
				Effect.tap((answer) =>
					Effect.sync(() => {
						pending.answer = answer;
					}),
				),
			);
		}
		return {
			answer: () => Effect.sync(() => pending.answer),
			deadlinePasses: () => {
				story.tell("the five-second read deadline passes");
				return pending.read === undefined ? Effect.die("Start a read first") : passes("5 seconds", Fiber.join(pending.read));
			},
			read,
			recordedLogs: () => Effect.sync(() => logs),
			recordedLogText: () => Effect.sync(() => JSON.stringify(logs)),
			recordedSpans: () => Effect.sync(() => spans.map(({ attributes }) => Object.fromEntries(attributes))),
			remoteUrl: () => Effect.succeed(remote.url),
			searches: () => Effect.sync(() => remote.requests.map(({ query }) => query.get("q"))),
			startRead: () => {
				story.tell("the client starts a read the remote has withheld");
				return Effect.gen(function* () {
					pending.read = yield* read().pipe(Effect.forkScoped);
					yield* untilTimer("5 seconds");
					if (pending.hold === undefined) {
						return yield* Effect.die("Withhold a read before starting it");
					}
					yield* pending.hold.waiting;
					if (pending.phase === "body") {
						yield* Deferred.await(lifecycle.current.started);
					}
				});
			},
			timeToLivePasses: () => {
				story.tell("the one-minute success cache lifetime passes");
				return passes("1 minute", Effect.void);
			},
		};
	},
});

export function outsideReply(body: unknown, status = 200) {
	return readApis.trait("routes", `the outside API answers with HTTP ${status} and ${JSON.stringify(body)}`, ({ replies }) => {
		replies.body = { body, status };
	});
}

export function withheldRead(phase: "headers" | "body") {
	return readApis.trait("routes", `the remote withholds the response ${phase}`, function* ({ pending, remote }) {
		pending.phase = phase;
		pending.hold = yield* phase === "headers" ? remote.hold("body") : remote.stall("body");
	});
}
