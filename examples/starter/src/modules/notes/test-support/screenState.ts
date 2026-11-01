import type { AnyRouter, RouterHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import type { Credentials } from "#client/Credentials.ts";
import { notesClient } from "#modules/notes/test-support/client.ts";
import type { appAuth } from "#test-support/appAuth.ts";
import type { ScreenSurface } from "#test-support/screenState.ts";

export interface Screen extends ScreenSurface {
	auth: ReturnType<typeof appAuth> | undefined;
	client: Effect.Success<ReturnType<typeof notesClient>>;
	history: RouterHistory | undefined;
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
		login: { authenticated: [], calls: [], outcome: undefined, unavailable: false },
		router: undefined,
		signOutCalls: [],
		switchSession: undefined,
		view: undefined,
	};
	return engine;
});
