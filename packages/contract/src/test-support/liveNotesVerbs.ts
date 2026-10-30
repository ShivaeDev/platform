import { Effect, Fiber, Ref, Stream, SubscriptionRef } from "effect";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import type { LiveHint } from "#live.ts";
import { ending, hintWords, streams } from "./answers.ts";
import {
	called,
	connect,
	dropWhileRefused,
	hintsHandled,
	type LiveEngine,
	type LiveView,
	readsBegunOf,
	reload,
	reReadDelayOf,
	shownOf,
	shownWithoutReadingOf,
	statusOf,
	streamRunner,
	timesReadOf,
	untilChangeHandled,
	untilHandledBeyond,
	untilReadAfterLastHint,
	viewAtom,
} from "./liveEngine.ts";
import { Note } from "./notes.ts";
import { signal, waited } from "./settle.ts";

export function liveNotesVerbs(engine: LiveEngine, story: Pick<Story<LiveEngine>, "tell">) {
	const { registry, server } = engine;
	const run = streamRunner(engine);
	function subscription() {
		if (engine.subscription === undefined) {
			throw new Error("Subscribe before reading or ending the subscription");
		}
		return engine.subscription;
	}
	function edit(id: number, body: string) {
		return untilChangeHandled(
			engine,
			Effect.promise(() => server.edit(id, body)),
		);
	}
	return {
		changeUnannounced: (id: number, body: string) => {
			story.tell(`note ${id}'s body becomes ${body} without any hint`);
			return Effect.promise(() => server.store(id, body));
		},
		connect: () => {
			story.tell("the client opens its live connection and handles the first hint");
			return connect(engine);
		},
		create: (title: string) => {
			story.tell(`the client creates the note ${title} over HTTP`);
			return Effect.map(called(engine, engine.client.api.create.run({ body: "", title })), (exit) =>
				ending(exit, (note) => `created note ${note.id} titled ${note.title}`),
			);
		},
		dispose: () =>
			Effect.gen(function* () {
				story.tell("the client disposes its registry");
				const open = yield* SubscriptionRef.get(server.active);
				registry.dispose();
				yield* signal(SubscriptionRef.changes(server.active), (count) => count < open);
			}),
		edit: (id: number, body: string) => {
			story.tell(`note ${id}'s body becomes ${body} and the server announces the change`);
			return edit(id, body);
		},
		editRepeatedly: (id: number, prefix: string, count: number) => {
			story.tell(`note ${id}'s body becomes ${prefix} 1 to ${prefix} ${count}, each change announced and handled before the next`);
			return Effect.forEach(
				Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`),
				(body) => edit(id, body),
				{ discard: true },
			);
		},
		get: (id: number) => {
			story.tell(`the client reads note ${id} once over HTTP`);
			return Effect.map(called(engine, engine.client.api.get.run({ id })), (exit) =>
				ending(exit, (note) => `note ${note.id} titled ${note.title}: ${note.body}${note instanceof Note ? "" : ", left as an undecoded object"}`),
			);
		},
		hintsHeard: () => {
			const { fiber, hints } = subscription();
			return Effect.map(
				waited(Effect.asVoid(Fiber.await(fiber)), () => undefined),
				() => hints.map(hintWords),
			);
		},
		interruptSubscription: () =>
			Effect.gen(function* () {
				story.tell("the client interrupts its subscription");
				const { controller, fiber } = subscription();
				controller.abort();
				yield* Fiber.await(fiber);
			}),
		mount: (view: LiveView) => {
			story.tell(`the client mounts ${view} again`);
			engine.mounted.set(view, registry.mount(viewAtom(engine, view)));
		},
		openServerStreams: () => Effect.map(SubscriptionRef.get(server.active), (count) => streams(count, "open")),
		pause: () => {
			story.tell("the client pauses live reads");
			registry.set(engine.client.paused, true);
		},
		readsBegun: (view: LiveView) => readsBegunOf(engine, view),
		releaseHeldReads: () => {
			story.tell("the server releases its held note reads");
			return server.releaseHeld();
		},
		reload: () => {
			story.tell("the client dehydrates its registry, resets it and hydrates it again");
			reload(engine);
		},
		rename: (id: number, title: string) => {
			story.tell(`the client renames note ${id} to ${JSON.stringify(title)} over HTTP`);
			return Effect.map(called(engine, engine.client.api.rename.run({ id, title })), (exit) =>
				ending(exit, (note) => `renamed note ${note.id} to ${note.title}`),
			);
		},
		reReadDelay: (view: LiveView) => reReadDelayOf(engine, view),
		resume: () => {
			story.tell("the client resumes");
			registry.set(engine.client.resume, registry.get(engine.client.resume) + 1);
		},
		serverAcceptsStreamsAgain: () =>
			Effect.gen(function* () {
				story.tell("the server accepts live streams again and the client reconnects");
				const before = yield* hintsHandled(engine);
				yield* Ref.set(server.streamUnavailable, false);
				yield* untilHandledBeyond(engine, before);
			}),
		serverReads: () => Effect.map(SubscriptionRef.get(server.served), (served) => served.map((read) => read.label)),
		serverSendsResyncs: (count: number) =>
			Effect.gen(function* () {
				story.tell(`the server sends ${count} resync hints, each handled before the next`);
				for (let sent = 0; sent < count; sent += 1) {
					const before = yield* SubscriptionRef.get(engine.client.handled);
					yield* Effect.promise(() => server.emit({ _tag: "Resync" }));
					yield* signal(SubscriptionRef.changes(engine.client.handled), (counts) => counts.Resync > before.Resync);
				}
			}),
		serverStreamClosed: () =>
			Effect.gen(function* () {
				const { opened } = subscription();
				yield* signal(SubscriptionRef.changes(server.active), (count) => count <= opened);
				return (yield* SubscriptionRef.get(server.active)) <= opened ? "closed" : "still open";
			}),
		serverStreamsOpened: () => Effect.map(SubscriptionRef.get(server.connections), (count) => streams(count, "opened")),
		shown: (view: LiveView) => shownOf(engine, view),
		shownWithoutReading: (view: LiveView) => shownWithoutReadingOf(engine, view),
		status: () => Effect.sync(() => statusOf(engine)),
		streamDropsAndReconnects: () =>
			Effect.gen(function* () {
				story.tell("the server ends the live stream and the client reconnects");
				const before = yield* hintsHandled(engine);
				yield* Effect.promise(server.disconnect);
				yield* untilHandledBeyond(engine, before);
			}),
		streamDropsWhileRefused: () => {
			story.tell("the server ends the live stream and refuses the client's reconnection as unavailable");
			return dropWhileRefused(engine);
		},
		subscribe: (take?: number) =>
			Effect.gen(function* () {
				story.tell(take === undefined ? "the client subscribes to live notes" : `the client subscribes to live notes for ${take} hints`);
				const opened = yield* SubscriptionRef.get(server.active);
				const hints: LiveHint[] = [];
				const controller = new AbortController();
				const stream =
					take === undefined ? engine.client.api.subscribe.run(undefined) : engine.client.api.subscribe.run(undefined).pipe(Stream.take(take));
				const fiber = yield* run(
					Stream.runForEach(stream, (hint) => Effect.sync(() => hints.push(hint))),
					controller.signal,
				).pipe(Effect.forkScoped);
				engine.subscription = { controller, fiber, hints, opened };
				yield* Effect.raceFirst(
					signal(SubscriptionRef.changes(server.active), (count) => count > opened),
					Effect.asVoid(Fiber.await(fiber)),
				);
			}),
		subscriptionEnding: () =>
			waited(
				Effect.map(Fiber.join(subscription().fiber), (exit) => ending(exit)),
				() => "still running",
			),
		timesRead: (view: LiveView) => timesReadOf(engine, view),
		unmount: (view: LiveView) => {
			story.tell(`the client unmounts ${view}`);
			engine.mounted.get(view)?.();
			engine.mounted.delete(view);
		},
		unpause: () => {
			story.tell("the client unpauses live reads");
			registry.set(engine.client.paused, false);
		},
		windowCloses: (...views: readonly LiveView[]) => {
			story.tell(`the coalescing window closes and the client re-reads ${views.join(" and ")}`);
			return untilReadAfterLastHint(engine, views);
		},
	};
}
