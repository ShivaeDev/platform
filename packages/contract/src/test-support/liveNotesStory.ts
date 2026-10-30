import { type Duration, Effect, Ref } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { liveClient } from "#test/live/client.ts";
import { liveServer } from "#test/live/server.ts";
import {
	connect,
	dropWhileRefused,
	holdReReadOfNoteOne,
	type LiveView,
	liveSnapshot,
	makeLiveEngine,
	untilChangeHandled,
	watch,
} from "./liveEngine.ts";
import { liveNotesVerbs } from "./liveNotesVerbs.ts";
import { notes } from "./notes.ts";

export const liveNotesStory = storyKit({
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const server = yield* Effect.acquireRelease(
				Effect.promise(() => liveServer()),
				(current) => Effect.promise(current.close),
			);
			const registry = yield* Effect.acquireRelease(
				Effect.sync(() => AtomRegistry.make()),
				(current) => Effect.sync(() => current.dispose()),
			);
			return makeLiveEngine(server, registry);
		}),
	inspect: liveSnapshot,
	name: "live notes",
	stages: ["session", "consumer", "views", "connection", "after"],
	verbs: liveNotesVerbs,
});

export function denied() {
	return liveNotesStory.trait("session", "the guard denies the session", (engine) => Ref.set(engine.server.denied, true));
}

export function serverRefusesStreams() {
	return liveNotesStory.trait("session", "the server refuses live streams as unavailable", (engine) =>
		Ref.set(engine.server.streamUnavailable, true),
	);
}

export function firstHintNamesOnlyNoteOne() {
	return liveNotesStory.trait("consumer", "each new live stream starts with a changed hint naming only note 1", (engine) =>
		Ref.set(engine.server.initialHint, { _tag: "Changed", keys: [notes.item(1)] }),
	);
}

export function withoutResumeSignal() {
	return liveNotesStory.trait("consumer", "the client's live connection has no resume signal", (engine) => {
		engine.client = liveClient(engine.server.url, {}, { includeResume: false });
	});
}

export function readScopeOfOnlyNoteOne() {
	return liveNotesStory.trait("consumer", "the client reconciles a read scope of only note 1", (engine) => {
		engine.client = liveClient(engine.server.url, {}, { resyncKeys: [notes.item(1)] });
	});
}

export function coalescingWindow(window: Duration.Input) {
	return liveNotesStory.trait("consumer", `the client's changed hints share a ${String(window)} window`, (engine) => {
		engine.registry.set(engine.client.coalesceWindow, window);
	});
}

export function watching(...views: readonly LiveView[]) {
	return liveNotesStory.trait("views", `the client watches ${views.join(", ")}, each read once`, (engine) => watch(engine, views));
}

export function connected() {
	return liveNotesStory.trait("connection", "the client's live connection has handled its first hint and re-read its views", connect);
}

export function paused() {
	return liveNotesStory.trait("after", "the client has paused live reads", (engine) => {
		engine.registry.set(engine.client.paused, true);
	});
}

export function noteOneEditedWhilePaused() {
	return liveNotesStory.trait("after", "note 1's body became Changed while paused, and the client counts it pending", (engine) =>
		untilChangeHandled(
			engine,
			Effect.promise(() => engine.server.edit(1, "Changed while paused")),
		),
	);
}

export function streamDroppedAndRefused() {
	return liveNotesStory.trait("after", "the live stream dropped and the server refuses the client's reconnections as unavailable", dropWhileRefused);
}

export function heldReReadOfNoteOne() {
	return liveNotesStory.trait("after", "the server holds every note read, and note 1's edit to In flight is being re-read", (engine) =>
		holdReReadOfNoteOne(engine, "every note read"),
	);
}
