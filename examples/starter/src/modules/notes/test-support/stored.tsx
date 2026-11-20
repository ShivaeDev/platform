import { createMemoryHistory } from "@tanstack/react-router";
import { DateTime, Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { App } from "#client/App.tsx";
import { clientModules } from "#client/modules.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { notesClient } from "#modules/notes/test-support/client.ts";
import { memoryQueryStorage } from "#modules/notes/test-support/memoryQueryStorage.ts";
import { screenObservations } from "#modules/notes/test-support/screenObservations.ts";
import { createScreen, type Screen } from "#modules/notes/test-support/screenState.ts";
import { settleQuery } from "#modules/notes/test-support/settleQuery.ts";
import { appAuth } from "#test-support/appAuth.ts";
import { acquireScreen, screenView } from "#test-support/screenState.ts";

const openStoredApp = Effect.fn("StoredNotes.openStoredApp")(function* (engine: Screen, storage: ReturnType<typeof memoryQueryStorage>) {
	const fixture = appAuth({ baseUrl: "http://app.test", signedIn: true });
	const view = yield* acquireScreen(engine);
	yield* Effect.promise(() =>
		view.render(
			<App
				auth={fixture.auth}
				connect={(session) => clientModules(session, [notesRegistration(engine.client)])}
				history={createMemoryHistory({ initialEntries: ["/"] })}
				persist={storage.layer}
			/>,
		),
	);
	yield* screenDriver({
		act,
		pending: () => view.registry.get(fixture.auth.session.atom).waiting || view.container.querySelector('section[aria-label="Saved notes"]') === null,
		root: view.container,
		tell: () => undefined,
	}).settle();
	yield* settleQuery(engine);
});

export const storedNotes = storyKit({
	clock: Effect.runSync(DateTime.now),
	*create() {
		const engine = yield* createScreen();
		engine.client = yield* notesClient([{ id: 1, title: "First note", version: 0, wordCount: null }]);
		return { engine, storage: memoryQueryStorage() };
	},
	inspect: ({ engine, storage }) => ({ stored: [...storage.users.keys()], text: engine.view?.container.textContent }),
	name: "stored notes",
	stages: ["screen"],
	verbs: ({ engine, storage }, story) => ({
		...screenObservations(engine),
		noteRevisedElsewhere: (title: string) => {
			story.tell(`the note is revised elsewhere to ${JSON.stringify(title)}`);
			return Effect.promise(() => engine.client.reviseNote(1, title, false));
		},
		releaseNotesList: () => {
			story.tell("the host answers the notes list");
			return Effect.promise(() => act(async () => engine.client.releaseList())).pipe(Effect.andThen(settleQuery(engine)));
		},
		reload: () =>
			Effect.gen(function* () {
				story.tell("the page hides and reloads while the host holds the notes list");
				yield* Effect.promise(() =>
					act(async () => {
						Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
						document.dispatchEvent(new Event("visibilitychange"));
						Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
					}),
				);
				yield* Effect.promise(screenView(engine).unmount);
				engine.client.holdList();
				yield* openStoredApp(engine, storage);
			}),
		updating: () =>
			Effect.sync(() => screenView(engine).container.querySelector('section[aria-label="Saved notes"]')?.getAttribute("aria-busy") === "true"),
	}),
});

export const notesOpenWithStorage = storedNotes.trait("screen", "alice opens her notes with stored results on", ({ engine, storage }) =>
	openStoredApp(engine, storage),
);
