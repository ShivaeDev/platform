import { type Duration, Effect, Layer, PubSub, Schema, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { LiveConnection } from "@shivaedev/effect-contract/automaticLive.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { type LiveHint, live } from "@shivaedev/effect-contract/live.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { LiveWindowRead } from "./LiveWindowRead.tsx";
import { Screen } from "./Screen.ts";

export const liveWindowScreen = storyKit({
	clock: "live",
	*create() {
		const hints = yield* PubSub.unbounded<LiveHint>();
		const screen = new Screen(() => undefined);
		const runtime = Atom.runtime(Layer.empty);
		const key = collection("notes", Schema.Number);
		let reads = 0;
		const query = runtime.factory.withReactivity(["notes"])(
			runtime.atom(
				Effect.sync(() => {
					reads += 1;
					return reads;
				}),
			),
		);
		const updates = live(runtime, { resyncKeys: [key.list], stream: Stream.fromPubSub(hints) });
		return { client: { [LiveConnection]: updates }, hints, query, reads: () => reads, screen, updates };
	},
	inspect: ({ reads, screen }) => ({ reads: reads(), ...screen.inspect() }),
	name: "session live coalescing window",
	stages: ["screen"],
	verbs: (engine, story) => {
		engine.screen.tell = story.tell;
		return {
			connection: () => engine.screen.roots[0]?.container.textContent,
			observe: (check: () => void) => engine.screen.observe("the live screen settles", check),
			open: (window: Duration.Input) =>
				engine.screen.open(
					<SessionBoundary connect={() => engine.client} identify={(id) => id} liveCoalesceWindow={window} recheck={() => undefined} session="ada">
						{() => <LiveWindowRead query={engine.query} />}
					</SessionBoundary>,
				),
			publish: (count: number, hint: LiveHint) =>
				engine.screen.act(`publish ${count} live hints`, () =>
					Effect.runPromise(Effect.forEach(Array.from({ length: count }), () => PubSub.publish(engine.hints, hint), { discard: true })),
				),
			reads: engine.reads,
		};
	},
});
