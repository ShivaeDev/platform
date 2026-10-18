import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import type { CodePreviewLine } from "#client/CodePreview.tsx";
import { authScreenVerbs } from "./authScreenVerbs.ts";
import { noteScreenVerbs } from "./noteScreenVerbs.ts";
import { notesClient } from "./notesClient.ts";
import { notesRefreshVerbs } from "./notesRefreshVerbs.ts";
import { screenActions } from "./screenActions.ts";
import { screenObservations } from "./screenObservations.ts";
import { openApp, openCodePreview, openLogin, openNotes, openRoute, openSession } from "./screenSetup.tsx";
import { createScreen, screenView } from "./screenState.ts";
import { uiScreenVerbs } from "./uiScreenVerbs.ts";

export const screens = storyKit({
	clock: "live",
	create: createScreen,
	inspect: (engine) => ({ calls: engine.client.calls, route: engine.router?.state.location.pathname, text: engine.view?.container.textContent }),
	name: "app screen",
	stages: ["list", "screen", "elsewhere"],
	verbs: (engine, story) => ({
		...screenActions(engine, story.tell),
		...uiScreenVerbs(engine, story.tell),
		...screenObservations(engine, story.tell),
		...noteScreenVerbs(engine, story.tell),
		...notesRefreshVerbs(engine, story.tell),
		...authScreenVerbs(engine, story.tell),
	}),
});

export function heldNotesList() {
	return screens.trait("list", "the first notes list request is held", (engine) => Effect.sync(() => engine.client.holdList()));
}

export function editingNote() {
	return screens.trait("screen", "the first note is open in the editor", function* (engine) {
		engine.client = notesClient([{ id: 1, title: "First note", version: 0, wordCount: null }]);
		yield* openRoute(engine, "/notes/1");
		yield* Effect.promise(() => eventually(() => expect(screenView(engine).container.querySelector("input")?.value).toBe("First note")));
	});
}

export function noteRevisedElsewhere(title: string) {
	return screens.trait("elsewhere", `the note was revised elsewhere to ${JSON.stringify(title)} without a live hint`, (engine) =>
		Effect.promise(() => engine.client.reviseNote(1, title, false)),
	);
}

export function notesRoute() {
	return screens.trait("screen", "the app is open at the notes route", (engine) => openRoute(engine, "/"));
}

export function signedOutNotesRoute() {
	return screens.trait("screen", "a signed-out session opens the protected notes route", (engine) => openRoute(engine, "/", false));
}

export function notesScreen(signOutFailure?: string) {
	return screens.trait(
		"screen",
		`the notes screen is open${signOutFailure === undefined ? "" : ` and sign-out fails with ${JSON.stringify(signOutFailure)}`}`,
		(engine) => openNotes(engine, signOutFailure),
	);
}

export function loginScreen(rejection: string) {
	return screens.trait("screen", `the login screen is open and authentication rejects with ${JSON.stringify(rejection)}`, (engine) =>
		openLogin(engine, rejection),
	);
}

export function failingSessionCheck() {
	return screens.trait("screen", "the app opens sign-in with a failing session check", (engine) =>
		openApp(engine, "/sign-in", { baseUrl: "http://session.story.test", sessionFailure: true }),
	);
}

export function refusedAppSignOut(message: string) {
	return screens.trait("screen", `the signed-in app's auth provider refuses sign-out with ${JSON.stringify(message)}`, (engine) =>
		openApp(engine, "/", { baseUrl: "http://actions.story.test", signedIn: true, signOutFailure: message }),
	);
}

export function aliceSession() {
	return screens.trait("screen", "Alice's session opens the notes app", openSession);
}

export function codePreviewScreen(lines: readonly CodePreviewLine[]) {
	return screens.trait("screen", "a code preview is open", (engine) => openCodePreview(engine, lines));
}
