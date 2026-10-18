import { Effect, Exit, Scope } from "effect";
import type { ReactNode } from "react";
import { render } from "@shivaedev/effect-react/client/testing.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { mountSession } from "./mountSession.ts";
import { createScreen, type ScreenEngine, trackScreen } from "./screenEngine.ts";

interface ScreenScope {
	readonly scope: Scope.Closeable;
	screen?: ScreenEngine;
}

function screen(engine: ScreenScope) {
	if (!engine.screen) {
		throw new Error("The screen scope has not started");
	}
	return engine.screen;
}

export const screenScopeStory = storyKit({
	after: {
		*scope(engine) {
			engine.screen = yield* Effect.gen(createScreen).pipe(Effect.provideService(Scope.Scope, engine.scope));
		},
	},
	clock: "live",
	*create() {
		const scope = yield* Effect.acquireRelease(Scope.make(), (current) => Scope.close(current, Exit.void));
		const engine: ScreenScope = { scope };
		return engine;
	},
	inspect: (engine) => ({ lastView: engine.screen?.lastView }),
	name: "screen scope",
	stages: ["scope"],
	verbs: (engine, story) => ({
		close: (exit: Exit.Exit<void, string>) => {
			story.tell("the screen scope closes");
			return Scope.close(engine.scope, exit);
		},
		mount: (node: ReactNode) =>
			Effect.gen(function* () {
				story.tell("the reader opens a screen");
				const view = yield* Effect.promise(() => render(node));
				return trackScreen(screen(engine), view, story.tell);
			}),
		openSession: () => {
			story.tell("the reader opens a live session within the screen scope");
			return mountSession(screen(engine), "response").pipe(Effect.provideService(Scope.Scope, engine.scope));
		},
		readTransport: () => {
			story.tell("the reader inspects the active browser transport");
			return globalThis.fetch;
		},
		snapshot: () => {
			story.tell("the reader inspects the retained screen");
			return screen(engine).lastView;
		},
	}),
});

export function failingScreenFinalizer() {
	return screenScopeStory.trait("scope", "a finalizer fails after screen cleanup", (engine) =>
		Scope.addFinalizer(engine.scope, Effect.die("a later finalizer failed")),
	);
}
