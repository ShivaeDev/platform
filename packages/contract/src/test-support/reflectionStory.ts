import { Deferred, Effect, Queue, Stream, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { LiveConnection } from "#automaticLive.ts";
import { shown } from "#test/answers.ts";
import { commandFlights } from "#test/commandFlights.ts";
import { type ReflectionEngine, reflectionEngine, type Viewer } from "#test/reflection/engine.ts";
import { settled } from "#test/settled.ts";

type Gate = ReflectionEngine["reads"];

const hold = Effect.fnUntraced(function* (gate: Gate) {
	gate.held = yield* Deferred.make<void>();
	yield* Queue.clear(gate.reached);
});

function release(gate: Gate) {
	return Effect.suspend(() => {
		const held = gate.held;
		gate.held = undefined;
		return held === undefined ? Effect.void : Deferred.succeed(held, undefined);
	});
}

function joined(engine: ReflectionEngine, viewer: Viewer) {
	const found = engine.viewers.get(viewer);
	return found === undefined ? Effect.die(`${viewer} has not joined the story`) : Effect.succeed(found);
}

function frames(engine: ReflectionEngine, viewer: Viewer, count: number) {
	return Effect.flatMap(joined(engine, viewer), (found) =>
		until(SubscriptionRef.changes(found.frames), (seen) => seen.length >= count, { name: `${count} frames for ${viewer}` }),
	);
}

export const reflectionStory = storyKit({
	clock: "test",
	create: () => reflectionEngine,
	inspect: ({ host, states }) => Effect.map(SubscriptionRef.get(states), (signals) => ({ ...host, signals })),
	name: "commands reflected in live queries over a real socket",
	stages: ["viewers", "view"],
	verbs: (engine, story) => {
		const { host, reads, registry, tab, writes } = engine;
		const flights = commandFlights(engine, story.tell);
		const { begin, complete } = flights;
		return {
			activity: flights.activity,
			anotherViewerWrites: (value: string) => {
				story.tell(`an older client writes ${value}`);
				return Effect.flatMap(joined(engine, "an older client"), ({ client }) => client("board.write", { value }));
			},
			beginSync: () => begin("the tab starts a sync", tab.sync),
			beginWrite: (value: string) => begin(`the tab starts writing ${value}`, tab.api.write.run({ value })),
			dropSocket: () =>
				Effect.gen(function* () {
					story.tell("the tab's socket drops and connects again");
					yield* Queue.clear(engine.connections);
					engine.sockets.opened.at(-1)?.close(4000);
					yield* Queue.take(engine.connections);
					yield* hold(reads);
					yield* TestClock.adjust("5 seconds");
					yield* until(Stream.fromQueue(engine.connections), (event) => event === "connected", { name: "reconnected socket" });
					engine.native.resume();
					yield* Queue.take(reads.reached);
				}),
			finished: flights.finished,
			framesOf: (viewer: Viewer, count: number) => frames(engine, viewer, count),
			holdReads: () => {
				story.tell("the host holds every read of the board");
				return hold(reads);
			},
			holdWrites: () => {
				story.tell("the host holds every write before it changes the board");
				return hold(writes);
			},
			loseListener: () => {
				story.tell("the host's change listener goes down");
				host.listening = false;
			},
			nameClient: (viewer: Viewer, name: string, id: number) => {
				story.tell(`${viewer} sends a command that names sync token ${id} of ${name}`);
				return Effect.flatMap(joined(engine, viewer), ({ client }) =>
					client("board.touch", undefined, { headers: { "x-shivaedev-sync": `${name}:${id}` } }),
				);
			},
			openView: () => {
				story.tell("the tab opens the board");
				registry.mount(engine.view);
			},
			pause: () => {
				story.tell("the tab pauses its live queries");
				registry.set(tab.api[LiveConnection].paused, true);
			},
			recoverListener: () => {
				story.tell("the host's change listener recovers and resyncs every stream");
				host.listening = true;
				return engine.live.resync();
			},
			refuseWrites: () => {
				story.tell("the host refuses writes");
				host.refusing = true;
			},
			releaseReads: () => {
				story.tell("the host answers its held reads");
				return release(reads);
			},
			releaseWrites: () => {
				story.tell("the host lets its held writes through");
				return release(writes);
			},
			shown: () => Effect.sync(() => shown(registry.get(engine.view), (value) => value)),
			signals: flights.signals,
			sync: () => complete("the tab syncs", tab.sync),
			touch: () => complete("the tab sends a command that changes nothing", tab.api.touch.run()),
			unpause: () => {
				story.tell("the tab resumes its live queries");
				registry.set(tab.api[LiveConnection].paused, false);
			},
			untilAccepted: flights.untilAccepted,
			untilHeldBack: (count: number) =>
				until(AtomRegistry.toStream(registry, tab.api[LiveConnection].status), (status) => status.pending >= count, {
					name: `${count} updates held back by the pause`,
				}),
			untilReadBegins: () => Queue.take(reads.reached),
			untilWriteArrives: () => Queue.take(writes.reached),
			write: (value: string) => complete(`the tab writes ${value}`, tab.api.write.run({ value })),
		};
	},
});

export function watching() {
	return reflectionStory.trait("view", "the tab shows the board", function* (engine) {
		engine.registry.mount(engine.view);
		yield* settled(engine.registry, engine.view);
	});
}

export function alongside(viewer: Viewer) {
	return reflectionStory.trait("viewers", `${viewer} watches the board too`, function* (engine) {
		const joining = yield* engine.viewer(viewer === "another tab" ? "another-tab" : undefined);
		engine.viewers.set(viewer, joining);
		yield* until(SubscriptionRef.changes(joining.frames), (seen) => seen.includes("First"), { name: `first board value for ${viewer}` });
	});
}
