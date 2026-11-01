import { Effect } from "effect";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { CodePreviewLine } from "#modules/notes/client/CodePreview.tsx";
import { requireSetup } from "#modules/notes/test-support/requireSetup.ts";
import { screenView } from "#test-support/screenState.ts";
import { themeScreenVerbs } from "#test-support/themeScreenVerbs.tsx";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";
import { authScreenVerbs } from "./authScreenVerbs.ts";
import { notesClient } from "./client.ts";
import { deleteControls, deleteControlVerbs } from "./deleteControls.tsx";
import { notesRefreshVerbs } from "./refreshVerbs.ts";
import { screenActions } from "./screenActions.ts";
import { screenObservations } from "./screenObservations.ts";
import { openApp, openCodePreview, openLogin, openNotes, openRoute, openSession } from "./screenSetup.tsx";
import { createScreen } from "./screenState.ts";
import { noteScreenVerbs } from "./screenVerbs.ts";
import { notesUiVerbs } from "./uiVerbs.ts";

expectNoReactWarnings();

export const screens = storyKit({
	clock: "live",
	create: createScreen,
	inspect: (engine) => ({
		reads: engine.client.observed.reads(),
		route: engine.router?.state.location.pathname,
		text: engine.view?.container.textContent,
	}),
	name: "app screen",
	stages: ["list", "provider", "screen", "elsewhere"],
	verbs: (engine, story) => ({
		...screenActions(engine, story.tell),
		...uiScreenVerbs(engine, story.tell),
		...notesUiVerbs(engine, story.tell),
		...themeScreenVerbs(engine, story.tell),
		...screenObservations(engine),
		...noteScreenVerbs(engine, story.tell),
		...notesRefreshVerbs(engine, story.tell),
		...authScreenVerbs(engine, story.tell),
		...deleteControlVerbs(engine, story.tell),
	}),
});

export function listedNote() {
	return screens.trait("list", "alice has saved First note, whose words are still being counted", function* (engine) {
		engine.client = yield* notesClient([{ id: 1, title: "First note", version: 0, wordCount: null }]);
	});
}

export function savedNotes(...titles: readonly string[]) {
	return screens.trait("list", `alice has saved ${titles.join(" and then ")}`, function* (engine) {
		engine.client = yield* notesClient(titles.map((title, index) => ({ id: index + 1, title, version: 0, wordCount: null })).reverse());
	});
}

export function authenticationOffline() {
	return screens.trait("provider", "the authentication provider is offline", (engine) =>
		Effect.sync(() => {
			engine.login.unavailable = true;
		}),
	);
}

export function heldNotesList() {
	return screens.trait("list", "the first notes list request is held", (engine) => Effect.sync(() => engine.client.holdList()));
}

export function editingNote() {
	return screens.trait("screen", "the first note is open in the editor", function* (engine) {
		engine.client = yield* notesClient([{ id: 1, title: "First note", version: 0, wordCount: null }]);
		yield* openRoute(engine, "/notes/1");
		yield* requireSetup(screenView(engine).container.querySelector("input")?.value === "First note", "The editor did not load First note");
	});
}

export function noteRevisedElsewhere(title: string) {
	return screens.trait("elsewhere", `the note was revised elsewhere to ${JSON.stringify(title)} without a live hint`, (engine) =>
		Effect.promise(() => engine.client.reviseNote(1, title, false)),
	);
}

export function saveDefect() {
	return screens.trait("elsewhere", "the notes server defects when saving", (engine) =>
		Effect.sync(() => {
			engine.client.faults.saveDefect = true;
		}),
	);
}

export function notesRoute() {
	return screens.trait("screen", "the app is open at the notes route", (engine) => openRoute(engine, "/"));
}

export function noteDeleteControls() {
	return screens.trait("screen", "each saved note has its own mounted delete control", deleteControls);
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

export function loginScreen(rejection?: string) {
	return screens.trait(
		"screen",
		`the login screen is open and authentication ${rejection === undefined ? "accepts" : `rejects with ${JSON.stringify(rejection)}`}`,
		(engine) => openLogin(engine, rejection),
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
	return screens.trait("screen", "alice's session opens the notes app with her saved note", function* (engine) {
		engine.client = yield* notesClient([{ id: 1, title: "Alice's saved note", version: 0, wordCount: null }]);
		yield* openSession(engine);
	});
}

export function codePreviewScreen(lines: readonly CodePreviewLine[]) {
	return screens.trait("screen", "a code preview is open", (engine) => openCodePreview(engine, lines));
}

export function malformedSession() {
	return screens.trait("screen", "the auth provider returns malformed session permissions", (engine) =>
		openApp(engine, "/", { baseUrl: "http://malformed.story.test", malformedSession: true, signedIn: true }),
	);
}
