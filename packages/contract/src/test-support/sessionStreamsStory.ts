import { Effect, Fiber, Queue, Stream, SubscriptionRef } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { ending } from "./answers.ts";
import { type StreamPerson, sessionStreamsEngine } from "./sessionStreamsEngine.ts";

const create = Effect.gen(function* () {
	const engine = yield* sessionStreamsEngine;
	const streams = new Map<string, { readonly fiber: Fiber.Fiber<string>; readonly heard: Queue.Queue<string> }>();
	return { ...engine, streams };
});

export const sessionStreamsStory = storyKit({
	clock: "live",
	create: () => create,
	inspect: (engine) => ({ open: Effect.runSync(SubscriptionRef.get(engine.open)), streams: [...engine.streams.keys()] }),
	name: "session-owned streams",
	stages: [],
	verbs: (engine, story) => {
		function subscription(name: string) {
			const found = engine.streams.get(name);
			if (found === undefined) {
				throw new Error(`No stream named ${name}`);
			}
			return found;
		}
		return {
			closeSession: (person: StreamPerson) => {
				story.tell(`${person} closes their session`);
				engine.registries[person].dispose();
			},
			heard: (name: string) => Queue.take(subscription(name).heard),
			interrupt: (name: string) => {
				story.tell(`the caller interrupts ${name}`);
				return Fiber.interrupt(subscription(name).fiber);
			},
			openStreams: () => SubscriptionRef.get(engine.open),
			start: (owner: StreamPerson | "ordinary", caller: StreamPerson, name: string, mode: "open" | "finite" | "refused" = "open") =>
				Effect.gen(function* () {
					story.tell(`${caller} consumes ${owner}'s ${name} stream (${mode})`);
					const heard = yield* Queue.unbounded<string>();
					const stream = engine.apis[owner].subscribe.run({ mode, name });
					const fiber = yield* engine
						.consume(
							Stream.runForEach(stream, (value) => Queue.offer(heard, value)),
							caller,
						)
						.pipe(
							Effect.exit,
							Effect.map((exit) => ending(exit)),
							Effect.forkScoped,
						);
					engine.streams.set(name, { fiber, heard });
				}),
			streamEnding: (name: string) => Fiber.join(subscription(name).fiber),
			untilClosed: (name: string) =>
				Effect.asVoid(until(SubscriptionRef.changes(engine.open), (all) => !all.includes(name), { name: `${name}'s server stream closes` })),
		};
	},
});
