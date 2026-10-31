import { Cause, Effect, Exit, Scope } from "effect";
import { createElement } from "react";
import { render } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { mountSession } from "./mountSession.ts";
import { createScreen, type ScreenEngine, trackScreen } from "./screenEngine.ts";

interface ScreenScope {
	readonly browserFetch: typeof fetch;
	readonly containers: HTMLElement[];
	last?: { unmount: () => Promise<void> };
	readonly scope: Scope.Closeable;
	screen?: ScreenEngine;
	tell?: (line: string) => void;
}

function screen(engine: ScreenScope) {
	if (!engine.screen) {
		throw new Error("The screen scope has not started");
	}
	return engine.screen;
}

const mount = Effect.fn("ScreenScope.mount")(function* (engine: ScreenScope, node: Parameters<typeof render>[0]) {
	const view = trackScreen(screen(engine), yield* Effect.promise(() => render(node)), (line) => engine.tell?.(line));
	engine.containers.push(view.container);
	engine.last = view;
});

export const screenScopeStory = storyKit({
	after: {
		*scope(engine) {
			engine.screen = yield* Effect.gen(createScreen).pipe(Effect.provideService(Scope.Scope, engine.scope));
		},
	},
	clock: "live",
	*create() {
		const scope = yield* Effect.acquireRelease(Scope.make(), (current) => Scope.close(current, Exit.void));
		const engine: ScreenScope = { browserFetch: globalThis.fetch, containers: [], scope };
		return engine;
	},
	inspect: (engine) => ({ lastView: engine.screen?.lastView }),
	name: "screen scope",
	stages: ["scope", "screens"],
	verbs: (engine, story) => {
		engine.tell = story.tell;
		return {
			connectedScreens: () =>
				Effect.sync(() => {
					story.tell("the reader counts the screens still in the document");
					return engine.containers.filter((container) => container.isConnected).length;
				}),
			endScope: (ending: "passed" | "failed") => {
				story.tell(`the story ${ending} and its screen scope closes`);
				return Scope.close(engine.scope, ending === "passed" ? Exit.void : Exit.fail("the reader's assertion failed")).pipe(
					Effect.catchCause((cause) => Effect.sync(() => story.tell(`a finalizer failed while the scope closed: ${Cause.pretty(cause)}`))),
				);
			},
			openSession: () => {
				story.tell("the reader opens a live session within the screen scope");
				return Effect.asVoid(mountSession(screen(engine), "response").pipe(Effect.provideService(Scope.Scope, engine.scope)));
			},
			retainedView: () =>
				Effect.sync(() => {
					story.tell("the reader reads the screen the story kept after closing");
					const view = screen(engine).lastView;
					return view === undefined ? "nothing retained" : { controls: view.controls, storage: view.storage, text: view.text };
				}),
			transport: () =>
				Effect.sync(() => {
					story.tell("the reader checks which transport the browser's fetch uses");
					return globalThis.fetch === engine.browserFetch ? "the browser's own fetch" : "the session transport";
				}),
		};
	},
});

export function screensOpen(count: number) {
	return screenScopeStory.trait("screens", `the reader opens ${count} screens, the latest with a drafted answer`, function* (engine: ScreenScope) {
		for (let index = 1; index < count; index += 1) {
			yield* mount(engine, createElement("p", null, `Earlier screen ${index}`));
		}
		yield* mount(engine, createElement("label", null, "Direction", createElement("input", { defaultValue: "Use local files", name: "answer" })));
		window.localStorage.setItem("draft", "Use local files");
	});
}

export function latestScreenClosedEarly() {
	return screenScopeStory.trait("screens", "the reader closes the latest screen before the story ends", (engine) =>
		Effect.promise(() => {
			if (!engine.last) {
				throw new Error("Open screens before closing the latest one");
			}
			return engine.last.unmount();
		}),
	);
}

export function failingScreenFinalizer() {
	return screenScopeStory.trait("scope", "a finalizer fails after screen cleanup", (engine) =>
		Scope.addFinalizer(engine.scope, Effect.die("a later finalizer failed")),
	);
}
