import { Effect } from "effect";
import { vi } from "vitest";
import { type Rendered, render } from "@shivaedev/effect-react/testing.ts";
import type { appRouter } from "#client/appRouter.tsx";
import type { Credentials } from "#client/auth.ts";
import type { appAuth } from "#test-support/appAuth.ts";
import { notesClient } from "#test-support/notesClient.ts";

export interface Screen {
	auth: ReturnType<typeof appAuth> | undefined;
	client: ReturnType<typeof notesClient>;
	consoleErrors: () => readonly (readonly unknown[])[];
	login: {
		authenticated: number;
		calls: { credentials: Credentials; mode: string }[];
		outcome: string | undefined;
		unavailable: boolean;
	};
	router: ReturnType<typeof appRouter> | undefined;
	signOutCalls: number;
	switchSession: ((id: string) => Promise<void>) | undefined;
	view: Rendered | undefined;
}

export const createScreen = Effect.fn("ScreenStory.createScreen")(function* () {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	const engine: Screen = {
		auth: undefined,
		client: notesClient(),
		consoleErrors: () => [],
		login: { authenticated: 0, calls: [], outcome: undefined, unavailable: false },
		router: undefined,
		signOutCalls: 0,
		switchSession: undefined,
		view: undefined,
	};
	const errors = yield* Effect.acquireRelease(
		Effect.sync(() => vi.spyOn(console, "error")),
		(spy) =>
			Effect.sync(() => {
				spy.mockRestore();
			}),
	);
	engine.consoleErrors = () => errors.mock.calls;
	return engine;
});

export type ScreenSurface = Pick<Screen, "view">;

export const acquireScreen = Effect.fn("ScreenStory.acquireScreen")(function* (engine: ScreenSurface) {
	engine.view = yield* Effect.acquireRelease(
		Effect.promise(() => render(null)),
		(view) => Effect.promise(view.unmount),
	);
	return engine.view;
});

export function screenView(engine: ScreenSurface) {
	if (engine.view === undefined) {
		throw new Error("No screen is open; give the story a screen trait");
	}
	return engine.view;
}
