import type { AnyRouter, RouterHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import type { Credentials } from "#client/Credentials.ts";
import { notesClient } from "#modules/notes/test-support/client.ts";
import { fakeHostApp, type NotesConnection } from "#modules/notes/test-support/fakeHostApp.ts";
import type { appAuth } from "#test-support/appAuth.ts";
import type { ScreenSurface } from "#test-support/screenState.ts";

export interface Screen extends ScreenSurface {
	auth: ReturnType<typeof appAuth> | undefined;
	client: Effect.Success<ReturnType<typeof notesClient>>;
	history: RouterHistory | undefined;
	live: NotesConnection | undefined;
	login: {
		authenticated: (string | undefined)[];
		calls: { credentials: Credentials; mode: string }[];
		outcome: string | undefined;
		unavailable: boolean;
	};
	router: AnyRouter | undefined;
	signOutCalls: undefined[];
	switchSession: ((id: string) => Promise<void>) | undefined;
	view: Rendered | undefined;
}

export const createScreen = Effect.fn("ScreenStory.createScreen")(function* () {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	const engine: Screen = {
		auth: undefined,
		client: yield* notesClient(),
		history: undefined,
		live: undefined,
		login: { authenticated: [], calls: [], outcome: undefined, unavailable: false },
		router: undefined,
		signOutCalls: [],
		switchSession: undefined,
		view: undefined,
	};
	return engine;
});

// The app the screens open against the fake notes host; each session's connection becomes the screen's live client.
export function screenApp(engine: Screen) {
	return fakeHostApp(engine.client.options, (live) => {
		engine.live = live;
	});
}

export function connected(engine: Screen) {
	if (engine.live === undefined) {
		throw new Error("The app has not connected; open a screen first");
	}
	return engine.live;
}

// A screen rendered without the session boundary connects the app itself, in the registry it renders with.
export function connectedIn(engine: Screen, registry: AtomRegistry.AtomRegistry) {
	return { connection: screenApp(engine).connect({ id: "alice" }, registry), live: connected(engine) };
}
