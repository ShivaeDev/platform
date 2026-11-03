import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { sharedDraftStorage } from "#test/adapters/sharedDraftStorage.ts";
import type { DraftFields } from "./draftFields.ts";
import { browserPersistence, draftStorage } from "./draftStorage.ts";
import { persistedDraftView } from "./persistedDraftView.tsx";
import type { Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { settleScreen } from "./settleScreen.ts";

draftStorage();
type Editor = "first" | "second";
type View = Awaited<ReturnType<typeof persistedDraftView>>;

function sharedEditors() {
	return { browser: false, complete: Deferred.makeUnsafe<void>(), persistence: sharedDraftStorage(), views: new Map<Editor, View>() };
}

const openEditor = Effect.fnUntraced(function* (state: ReturnType<typeof sharedEditors>, screen: Screen, now: () => number, editor: Editor) {
	screen.tell(`open the ${editor} editor on Paper / 300`);
	const previous = state.views.get(editor);
	if (previous) {
		yield* Effect.promise(previous.unmount);
	}
	const root = yield* screen.open();
	const persistence = state.browser ? yield* browserPersistence : { storage: () => state.persistence.storage };
	function save(values: typeof DraftFields.Type) {
		return Deferred.await(state.complete).pipe(Effect.as({ ...values, quantity: String(values.quantity) }));
	}
	const opened = yield* Effect.promise(() => persistedDraftView(root, { key: "shared", now, storage: persistence.storage }, save));
	state.views.set(editor, opened);
});

function fields(view: View) {
	function input(name: string) {
		const found = view.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
		if (!found) {
			throw new Error(`Missing ${name} in the draft editor`);
		}
		return found.value;
	}
	return { name: input("name"), quantity: input("quantity") };
}

export const sharedDrafts = storyKit({
	...screenKit("shared draft editors", sharedEditors, (state, screen, now) => {
		function view(editor: Editor) {
			const found = state.views.get(editor);
			if (!found) {
				throw new Error(`The ${editor} editor is not open`);
			}
			return found;
		}
		return {
			browserChanged: () =>
				screen.act("the browser reports a draft change from another window", () =>
					window.dispatchEvent(
						new StorageEvent("storage", {
							key: "shared",
							newValue: window.localStorage.getItem("shared"),
							storageArea: window.localStorage,
						}),
					),
				),
			finishRead: () => screen.act("the second editor's older storage read responds", () => Effect.runPromise(state.persistence.finishRead())),
			finishSave: () =>
				screen
					.act("the first editor's held save responds", () => Effect.runPromise(Deferred.succeed(state.complete, undefined)))
					.pipe(Effect.andThen(Effect.suspend(() => settleScreen(view("first").container, () => view("first").editor().saving, screen.tell)))),
			finishWrite: () => screen.act("storage finishes writing the submitted draft", () => Effect.runPromise(state.persistence.finishWrite())),
			holdRead: () =>
				Effect.sync(() => {
					screen.tell("storage holds the second editor's initial read");
					state.persistence.holdRead();
				}),
			holdWrite: () =>
				Effect.sync(() => {
					screen.tell("storage holds the first editor's write");
					state.persistence.holdWrite();
				}),
			open: (editor: Editor) => openEditor(state, screen, now, editor),
			shown: (editor: Editor) => Effect.sync(() => fields(view(editor))),
			signOut: () => screen.act("the first editor signs out", () => view("first").show(undefined)),
			submit: () => screen.act("the first editor submits its draft", () => view("first").save()),
			type: (editor: Editor, field: "name" | "quantity", value: string) =>
				screen.act(`the ${editor} editor types ${field}: ${value}`, () => view(editor).change(field, value)),
		};
	}),
});

export function browserStorage() {
	return sharedDrafts.trait("screen", "drafts use browser storage", ({ state }) => {
		state.browser = true;
	});
}
