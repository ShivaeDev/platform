import { Context, type Duration, Effect, Fiber, Queue, Result, Stream } from "effect";
import { TestClock } from "effect/testing";
import { AuthUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeSocketSession, SocketSession } from "#server/socketSession.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "./postgres.ts";
import { revalidationClock } from "./revalidationClock.ts";
import { signOut } from "./sessionLifecycle.ts";
import { streamSessionEngine } from "./streamSessionEngine.ts";

type Method = "identity" | "profile" | "accounts" | "optional";

const DEFAULT_INTERVAL = "30 seconds";

function ending(result: Result.Result<void, unknown>) {
	if (Result.isSuccess(result)) {
		return "ended";
	}
	const error = result.failure;
	if (error instanceof AuthUnavailable) {
		return "auth unavailable";
	}
	return error instanceof Unauthorized ? "unauthorized" : `failed: ${String(error)}`;
}

export const streamSession = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	create: streamSessionEngine,
	layer: postgres,
	name: "stream session",
	runIf: databaseUrl !== undefined,
	stages: ["policy", "connection", "subscription"],
	verbs: (engine, story) => {
		function subscribed() {
			if (engine.state.subscription === undefined) {
				throw new Error("Nobody has subscribed to a stream");
			}
			return engine.state.subscription;
		}
		return {
			aliceSignsOut: () => {
				story.tell("alice signs out through Better Auth");
				return signOut(engine.provider, { cookie: engine.account.cookie });
			},
			echo: (message: string) => {
				story.tell(`the stream is sent "${message}"`);
				return Queue.offer(engine.input, message).pipe(
					Effect.andThen(
						Effect.raceFirst(
							Queue.take(engine.output).pipe(Effect.map((echoed) => echoed.replace(engine.account.userId, "alice"))),
							subscribed().pipe(Effect.map((end) => `the stream ${end}`)),
						),
					),
				);
			},
			lookupCount: () => engine.provider.lookups(),
			...revalidationClock(() => engine.state.interval ?? DEFAULT_INTERVAL, engine.checked, story.tell),
			sessionStoreBlips: () =>
				Effect.sync(() => {
					story.tell("the next session lookup cannot reach storage");
					engine.state.failures += 1;
				}),
			streamEnd: () => subscribed(),
			streamEnds: () => Effect.all(engine.state.subscriptions),
			timePasses: (duration: Duration.Input) => {
				story.tell(`${duration} pass`);
				return TestClock.adjust(duration);
			},
		};
	},
});

function subscription(method: Method, line: string, signedIn: boolean) {
	return streamSession.trait("subscription", line, (engine) =>
		Effect.gen(function* () {
			const fiber = yield* engine.client[method](undefined, { headers: signedIn ? { cookie: engine.account.cookie } : {} }).pipe(
				Stream.runForEach((value) => Queue.offer(engine.output, value)),
				Effect.result,
				Effect.map(ending),
				Effect.provide(engine.state.shared === undefined ? engine.services : Context.add(engine.services, SocketSession, engine.state.shared)),
				Effect.forkScoped,
			);
			engine.state.subscription = Fiber.join(fiber);
			engine.state.subscriptions.push(Fiber.join(fiber));
			yield* Queue.take(engine.checked);
		}),
	);
}

export function revalidatesEvery(interval: Duration.Input) {
	return streamSession.trait("policy", `the app checks stream sessions every ${interval}`, (engine) => {
		engine.state.interval = interval;
	});
}

export function aliceSubscribesTo(method: Method) {
	return subscription(method, `signed-in alice subscribes to ${method} and her session is checked once`, true);
}

export const anonymousSubscribesToOptional = subscription(
	"optional",
	"an anonymous caller subscribes to Optional and the missing session is checked once",
	false,
);

export const sharedConnection = streamSession.trait("connection", "one socket owns every stream session check", function* (engine) {
	engine.state.shared = yield* makeSocketSession(engine.state.interval ?? DEFAULT_INTERVAL);
});
