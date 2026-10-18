import { Clock, Deferred, Effect } from "effect";
import { vi } from "vitest";
import type { BrowserDraftConfig } from "@shivaedev/effect-form/client/react.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import type { Row, Save, ViewEditor } from "./draftFields.ts";
import { draftStorage } from "./draftStorage.ts";
import { persistedDraftView } from "./persistedDraftView.tsx";
import { clickButton } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

draftStorage();
interface State {
	complete: Deferred.Deferred<void>;
	config?: BrowserDraftConfig | undefined;
	storage?: BrowserDraftConfig["storage"];
	view?: Awaited<ReturnType<typeof persistedDraftView>>;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("The draft screen is not open");
	}
	return state.view;
}
export const drafts = storyKit(
	screenKit(
		"persisted draft screen",
		(): State => ({ complete: Effect.runSync(Deferred.make<void>()) }),
		(state, screen) => ({
			activity: (mode: "visible" | "hidden") => screen.act(`Activity is ${mode}`, () => current(state).activity(mode)),
			advanceAgeBy: (ms: number) => {
				screen.tell(`the draft ages by ${ms} milliseconds`);
				vi.useFakeTimers({ toFake: ["Date"] });
				vi.setSystemTime(Effect.runSync(Clock.currentTimeMillis) + ms);
			},
			draft: () => current(state),
			finishSave: () => screen.act("the save responds", () => Effect.runPromise(Deferred.succeed(state.complete, undefined))),
			refresh: (row: Row) => screen.act(`refresh the row: ${JSON.stringify(row)}`, () => current(state).refresh(row)),
			*reload(config = state.config) {
				screen.tell("reload the draft in a fresh root and registry");
				yield* Effect.promise(current(state).unmount);
				const view = yield* screen.open();
				state.view = yield* Effect.promise(() => persistedDraftView(view, config));
			},
			revert: () => screen.act("revert the draft", () => clickButton(current(state).container, "Revert")),
			show: (session: string | undefined, visible = true) =>
				screen.act(`show session ${session}, visible ${visible}`, () => current(state).show(session, visible)),
			staleEdit: (form: NonNullable<ViewEditor["form"]>, value: string) =>
				screen.act(`a stale form edits name: ${value}`, () => form.change("name", value)),
			storage: () => state.storage,
			storeDraft: (raw: string) => {
				screen.tell("replace the stored draft with encoded input");
				window.localStorage.setItem("order-draft", raw);
			},
			submit: () => screen.act("submit the draft", () => current(state).save()),
			type: (name: "name" | "quantity", value: string) => screen.act(`type ${name}: ${value}`, () => current(state).change(name, value)),
		}),
	),
);
export function persistedDraft(config?: BrowserDraftConfig | undefined, save: "immediate" | "held" | "rejected" = "immediate") {
	return drafts.trait("screen", `an editable persisted draft with ${save} saves`, function* ({ screen, state }) {
		state.config = config;
		const saveRow: Save = (values) => {
			const row = { ...values, quantity: String(values.quantity) };
			if (save === "rejected") {
				return Effect.fail("Rejected");
			}
			if (save === "held") {
				return Deferred.await(state.complete).pipe(Effect.as(row));
			}
			return Effect.succeed(row);
		};
		const view = yield* screen.open();
		state.view = yield* Effect.promise(() => persistedDraftView(view, config, saveRow));
	});
}

export function unavailableDraft(failure: string) {
	const storage = {
		getItem: vi.fn(() => {
			if (failure === "read") {
				throw new Error("Denied");
			}
			return null;
		}),
		removeItem: vi.fn(() => {
			if (failure === "remove") {
				throw new Error("Denied");
			}
		}),
		setItem: vi.fn(() => {
			if (failure === "write") {
				throw new Error("Quota");
			}
		}),
	};
	const getStorage = vi.fn(() => {
		if (failure === "getter") {
			throw new Error("Denied");
		}
		return storage;
	});
	return drafts.traits(
		drafts.trait("screen", `storage ${failure} is unavailable`, ({ state }) => {
			state.storage = getStorage;
		}),
		persistedDraft({ key: "unavailable", storage: getStorage }),
	);
}
export function storedDraft(raw: string) {
	return drafts.trait("screen", "an existing encoded draft", () => {
		window.localStorage.setItem("order-draft", raw);
	});
}
