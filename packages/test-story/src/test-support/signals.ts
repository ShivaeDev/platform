import { Clock, Effect, Queue, Scope, Stream } from "effect";
import { storyKit } from "#storyKit.ts";
import { collectUntil, type SignalNotReceived, until } from "#until.ts";
import { attempt } from "./attempt.ts";

interface SignalValue {
	readonly status: string;
}

interface SignalEngine {
	ending: string;
	lifetime: string[];
	mode: "burst" | "quiet" | "clock" | "empty" | "failed" | "silent";
	result: SignalValue | readonly SignalValue[] | undefined;
	seen: string[];
}

export const signals = storyKit({
	create: (): SignalEngine => ({
		ending: "not started",
		lifetime: [],
		mode: "burst",
		result: undefined,
		seen: [],
	}),
	name: "signal waits",
	stages: ["source"],
	verbs: (engine, story) => {
		const stream = Stream.suspend(() => {
			if (engine.mode === "silent") {
				return Stream.never;
			}
			if (engine.mode === "empty") {
				return Stream.empty;
			}
			if (engine.mode === "failed") {
				return Stream.fail("source failed");
			}
			if (engine.mode === "clock") {
				return Stream.concat(Stream.make({ status: "waiting" }), Stream.fromEffect(Effect.sleep(1).pipe(Effect.as({ status: "ready" }))));
			}
			return Stream.callback<SignalValue>((queue) =>
				Effect.gen(function* () {
					engine.lifetime.push("subscribed");
					yield* Scope.addFinalizer(
						yield* Effect.scope,
						Effect.sync(() => {
							engine.lifetime.push("unsubscribed");
						}),
					);
					yield* Queue.offer(queue, { status: "waiting" });
					if (engine.mode === "burst") {
						yield* Queue.offerAll(queue, [{ status: "ready" }, { status: "later" }]);
					}
				}),
			);
		});
		function matches(value: SignalValue) {
			engine.seen.push(`${engine.lifetime.at(0) ?? "not subscribed"}: ${value.status}`);
			return value.status === "ready";
		}
		function remember(value: SignalValue | readonly SignalValue[]) {
			return Effect.sync(() => {
				engine.result = value;
			});
		}
		function recordEnding(ending: string) {
			return Effect.sync(() => {
				engine.ending = ending;
			});
		}
		return {
			ending: () => engine.ending,
			lifetime: () => engine.lifetime,
			result: () => engine.result,
			seen: () => engine.seen,
			time: () => Clock.currentTimeMillis,
			wait: (collect = false) => {
				story.tell(`wait for ${collect ? "collected signals" : "the ready signal"}`);
				const options = { name: "ready", timeout: "30 millis" } as const;
				const wait: Effect.Effect<SignalValue | readonly SignalValue[], string | SignalNotReceived> = collect
					? collectUntil(stream, (values) => values.some(matches), options)
					: until(stream, matches, options);
				return attempt(wait.pipe(Effect.tap(remember))).pipe(Effect.tap(recordEnding));
			},
		};
	},
});

export function source(mode: "quiet" | "clock" | "empty" | "failed" | "silent") {
	return signals.trait("source", `the signal source is ${mode}`, (engine) => {
		engine.mode = mode;
	});
}
