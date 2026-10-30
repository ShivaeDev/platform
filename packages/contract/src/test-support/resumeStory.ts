import { Effect, Ref, Stream, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resumeSignal } from "#resume.ts";
import { failure, streams, times } from "./answers.ts";
import { automaticResumeClient } from "./automaticResumeClient.ts";
import { localEngine } from "./localEngine.ts";
import { Note } from "./notes.ts";
import { type Mark, reRead } from "./reRead.ts";
import { syntheticNative, syntheticWindow } from "./resumeSources.ts";
import { settled, signal } from "./settle.ts";

export type Resume = "the browser fires visibilitychange while visible" | "the browser fires online while visible" | "the native application resumes";
type Hidden = "the browser fires visibilitychange while hidden" | "the browser fires online while hidden";
type GlobalEvent = "online" | "visibilitychange";

interface Watching {
	automatic: ReturnType<typeof automaticResumeClient> | undefined;
	readonly watched: number[];
}

const resumeEngine = Effect.gen(function* () {
	const local = yield* localEngine;
	const browser = syntheticWindow();
	const native = syntheticNative();
	const unwatched: Watching = { automatic: undefined, watched: [] };
	return {
		...local,
		...unwatched,
		browser,
		marked: new Map<number, Mark<Note, unknown>>(),
		native,
		signal: resumeSignal({ native: native.source, window: browser.window }),
		views: new Map<number, Atom.Atom<AsyncResult.AsyncResult<Note, unknown>>>(),
	};
});
type ResumeEngine = Effect.Success<typeof resumeEngine>;

function api(engine: ResumeEngine) {
	return engine.automatic?.api ?? engine.api;
}

// The plain client reads through Atom's own refresh-on-signal, so only the resume signal itself is the contract's work there.
function viewAtom(engine: ResumeEngine, id: number): Atom.Atom<AsyncResult.AsyncResult<Note, unknown>> {
	const query = api(engine).get.query({ id });
	if (engine.automatic !== undefined) {
		return query;
	}
	const existing = engine.views.get(id);
	if (existing !== undefined) {
		return existing;
	}
	const view = Atom.makeRefreshOnSignal(engine.signal)(query);
	engine.views.set(id, view);
	return view;
}

function shownOf(engine: ResumeEngine, id: number) {
	return Effect.map(settled(engine.registry, viewAtom(engine, id)), (result) => {
		if (AsyncResult.isSuccess(result)) {
			return result.value.title;
		}
		return AsyncResult.isFailure(result) ? failure(result.cause) : "still loading";
	});
}

function readsOf(reads: readonly string[], id: number) {
	return reads.filter((label) => label === `get:${id}`).length;
}

function mark(engine: ResumeEngine) {
	const reads = Effect.runSync(SubscriptionRef.get(engine.server.reads));
	for (const id of engine.watched) {
		engine.marked.set(id, { reads: readsOf(reads, id), shown: engine.registry.get(viewAtom(engine, id)) });
	}
}

function automaticOf(engine: ResumeEngine) {
	if (engine.automatic === undefined) {
		throw new Error("Use the automaticLive trait before reading automatic streams");
	}
	return engine.automatic;
}

export const resumeStory = storyKit({
	clock: "live",
	create: () => resumeEngine,
	inspect: ({ browser, native, server }) => ({
		browserListeners: browser.listeners.size,
		nativeListeners: native.listeners.size,
		reads: Effect.runSync(SubscriptionRef.get(server.reads)),
	}),
	name: "notes resume",
	stages: ["client", "views"],
	verbs: (engine, story) => ({
		changeQuietly: (id: number, title: string) => {
			story.tell(`note ${id} is renamed to ${title} on the server without any hint`);
			return Ref.update(engine.server.stored, (all) => {
				const note = all.get(id);
				return note === undefined ? all : new Map([...all, [id, new Note({ ...note, title })]]);
			});
		},
		dispose: () => {
			story.tell("the client disposes its registry");
			engine.registry.dispose();
		},
		fireHidden: (event: Hidden) => {
			story.tell(event);
			engine.browser.fire(event.includes("online") ? "online" : "visibilitychange", "hidden");
		},
		globalWindowFires: (event: GlobalEvent) => {
			story.tell(`the global window fires ${event}`);
			mark(engine);
			window.dispatchEvent(new Event(event));
		},
		listeners: () => Effect.sync(() => ({ browser: engine.browser.listeners.size, native: engine.native.listeners.size })),
		openStreams: () => Effect.map(SubscriptionRef.get(automaticOf(engine).active), (count) => streams(count, "open")),
		resume: (trigger: Resume) => {
			story.tell(trigger);
			mark(engine);
			if (trigger === "the native application resumes") {
				engine.native.resume();
			} else {
				engine.browser.fire(trigger.includes("online") ? "online" : "visibilitychange");
			}
		},
		shown: (id: number) => shownOf(engine, id),
		streamsDrop: () =>
			Effect.gen(function* () {
				story.tell("the server ends every live stream");
				const automatic = automaticOf(engine);
				mark(engine);
				yield* automatic.disconnect;
				yield* signal(SubscriptionRef.changes(automatic.active), (count) => count === 0);
			}),
		streamsOpened: () => Effect.map(SubscriptionRef.get(automaticOf(engine).opened), (count) => streams(count, "opened")),
		timesRead: (id: number) =>
			Effect.andThen(
				shownOf(engine, id),
				Effect.map(SubscriptionRef.get(engine.server.reads), (reads) => `read ${times(readsOf(reads, id))}`),
			),
		untilReRead: (id: number) => {
			story.tell(`note ${id} is re-read and the new title reaches its view`);
			return reRead(
				engine.registry,
				viewAtom(engine, id),
				Stream.map(SubscriptionRef.changes(engine.server.reads), (all) => readsOf(all, id)),
				engine.marked.get(id),
			);
		},
	}),
});

export function automaticLive(resume: "native" | "browser") {
	return resumeStory.trait(
		"client",
		resume === "native"
			? "the client's bound queries go live automatically with the native resume source"
			: "the client's bound queries go live automatically and resume from the global window",
		(engine) => {
			engine.automatic = automaticResumeClient(engine.server, resume === "native" ? engine.native.source : undefined);
		},
	);
}

export function watching(...ids: readonly number[]) {
	return resumeStory.trait("views", `the client watches ${ids.map((id) => `note ${id}`).join(" and ")}, each read once`, (engine) =>
		Effect.gen(function* () {
			for (const id of ids) {
				engine.registry.mount(viewAtom(engine, id));
				engine.watched.push(id);
			}
			for (const id of ids) {
				yield* shownOf(engine, id);
			}
		}),
	);
}
