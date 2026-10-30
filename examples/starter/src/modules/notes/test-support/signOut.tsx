import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { act } from "react";
import { authAction } from "@shivaedev/react/client/authAction.ts";
import { expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AuthActions } from "#client/auth.ts";
import { connectModules } from "#client/Module.ts";
import { SessionApp } from "#client/SessionApp.tsx";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { notesClient } from "#modules/notes/test-support/client.ts";
import { acquireScreen, type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { screenAuth } from "./screenAuth.ts";

const warnings = expectNoReactWarnings();

export const signOut = storyKit({
	clock: "live",
	*create() {
		const response = Promise.withResolvers<{ readonly data: object; readonly error: null }>();
		const requested = Promise.withResolvers<void>();
		const client = notesClient();
		const history = createMemoryHistory({ initialEntries: ["/"] });
		const auth: AuthActions = {
			...screenAuth(),
			signOut: authAction<void, object, never>(() => {
				requested.resolve();
				return response.promise;
			}),
		};
		const screen: ScreenSurface = { view: undefined };
		const view = yield* acquireScreen(screen, {
			onCaughtError: (error, info) => warnings.expectCaughtError((caught) => caught instanceof Error && caught.name === "Unauthorized")(error, info),
		});
		function render(signedIn: boolean) {
			client.session.signedIn = signedIn;
			return view.render(
				<SessionApp
					auth={auth}
					connect={() => connectModules([notesRegistration(client)])}
					history={history}
					recheck={() => undefined}
					session={signedIn ? { user: { permissions: [] } } : null}
					sessionId={signedIn ? "alice-session" : "anonymous"}
				/>,
			);
		}
		return { ...screen, history, render, requested, response };
	},
	inspect: (engine) => ({ href: engine.history.location.href, text: screenView(engine).container.textContent }),
	name: "notes sign-out",
	stages: ["screen"],
	verbs: (engine, story) => {
		const driver = screenDriver({
			act,
			pending: () => screenView(engine).container.querySelector('[role="status"]') !== null,
			root: () => screenView(engine).container,
			tell: story.tell,
		});
		return {
			...driver,
			becomeAnonymous: () =>
				Effect.promise(() => {
					story.tell("the session owner replaces Alice's session with an anonymous session");
					return engine.render(false);
				}),
			href: () => engine.history.location.href,
			releaseResponse: () =>
				Effect.promise(() =>
					act(async () => {
						story.tell("the sign-out response arrives");
						engine.response.resolve({ data: {}, error: null });
						await engine.response.promise;
					}),
				),
			requested: () => Effect.promise(() => engine.requested.promise),
		};
	},
});

export function signedInNotes() {
	return signOut.trait("screen", "Alice opens the real notes route with the sign-out response held", (engine) =>
		Effect.promise(() => engine.render(true)),
	);
}
