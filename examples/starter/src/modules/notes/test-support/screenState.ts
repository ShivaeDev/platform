import type { AnyRouter, RouterHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { vi } from "vitest";
import type { Rendered } from "@shivaedev/react/client/testing.ts";
import type { Credentials } from "#client/auth.ts";
import { notesClient } from "#modules/notes/test-support/client.ts";
import type { appAuth } from "#test-support/appAuth.ts";

export interface Screen {
	auth: ReturnType<typeof appAuth> | undefined;
	client: ReturnType<typeof notesClient>;
	consoleErrors: () => readonly (readonly unknown[])[];
	history: RouterHistory | undefined;
	login: {
		authenticated: (string | undefined)[];
		calls: { credentials: Credentials; mode: string }[];
		outcome: string | undefined;
		unavailable: boolean;
	};
	routeErrors: unknown[];
	router: AnyRouter | undefined;
	signOutCalls: undefined[];
	switchSession: ((id: string) => Promise<void>) | undefined;
	view: Rendered | undefined;
}

export const createScreen = Effect.fn("ScreenStory.createScreen")(function* () {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	const engine: Screen = {
		auth: undefined,
		client: notesClient(),
		consoleErrors: () => [],
		history: undefined,
		login: { authenticated: [], calls: [], outcome: undefined, unavailable: false },
		routeErrors: [],
		router: undefined,
		signOutCalls: [],
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
