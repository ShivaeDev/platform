import { Deferred, Effect } from "effect";
import { vi } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { draftStorage } from "./draftStorage.ts";
import { type Config, current, draftVerbs, type Field, fields, type SaveMode, type State } from "./draftVerbs.ts";
import type { Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

draftStorage();

export const drafts = storyKit({
	...screenKit(
		"persisted draft screen",
		(): State => ({ complete: Deferred.makeUnsafe<void>(), config: { key: "order-draft" }, holding: false, save: "immediate" }),
		(state, screen, now) => ({
			...draftVerbs(state, screen, now),
			fields: () => Effect.sync(() => fields(state)),
			form: () => Effect.sync(() => (current(state).editor().form === state.firstForm ? "first form" : "replaced form")),
			nameLength: () => Effect.sync(() => fields(state).name.length),
			saveError: () => Effect.sync(() => current(state).container.querySelector('[role="alert"]')?.textContent ?? "none"),
			screenText: () => Effect.sync(() => current(state).container.textContent),
			status: () => Effect.sync(() => current(state).container.querySelector("output")?.textContent),
			storageConsulted: () => Effect.sync(() => (state.storage?.mock.calls.length ? "consulted" : "never consulted")),
			stored: () =>
				Effect.sync(() => {
					const raw = window.localStorage.getItem(state.config.key);
					return raw === null ? "none" : JSON.parse(raw).values;
				}),
		}),
	),
	clock: "test",
});

interface Engine {
	readonly now: () => number;
	readonly screen: Screen;
	readonly state: State;
}

function verbs({ now, screen, state }: Engine) {
	return draftVerbs(state, screen, now);
}

function* openWith(engine: Engine, config: Config, save: SaveMode = "immediate") {
	engine.state.config = config;
	engine.state.save = save;
	yield* verbs(engine).open();
}

function savesDescribed(save: SaveMode) {
	return { held: "saves the test holds", immediate: "saves that succeed", rejected: "saves the server rejects" }[save];
}

export function persistedDraft(config: Config = { key: "order-draft" }, save: SaveMode = "immediate") {
	const limits = [
		config.maxAgeMs && `drafts expiring after ${config.maxAgeMs}ms`,
		config.maxBytes && `drafts limited to ${config.maxBytes} bytes`,
	].filter(Boolean);
	return drafts.trait("screen", `a persisted draft editor on Paper / 300 with ${[savesDescribed(save), ...limits].join(" and ")}`, (engine) =>
		openWith(engine, config, save),
	);
}

export function draftTyped(field: Field, value: string, config: Config = { key: "order-draft" }, save: SaveMode = "immediate") {
	return drafts.trait(
		"screen",
		`a persisted draft editor with ${field} typed as ${JSON.stringify(value)} and ${savesDescribed(save)}`,
		function* (engine) {
			yield* openWith(engine, config, save);
			yield* verbs(engine).type(field, value);
		},
	);
}

export function invalidInputTyped() {
	return drafts.trait("screen", 'a persisted draft editor holding the invalid input "" / "-"', function* (engine) {
		yield* openWith(engine, { key: "order-draft" });
		const { type } = verbs(engine);
		yield* type("quantity", "-");
		yield* type("name", "");
	});
}

export function restoredAfterReload(refreshed = false) {
	return drafts.trait(
		"screen",
		`the draft name Typed answer restored by a reload${refreshed ? " and the query refreshed to Remote / 350" : ""}`,
		function* (engine) {
			yield* openWith(engine, { key: "order-draft" });
			const { refresh, reload, type } = verbs(engine);
			yield* type("name", "Typed answer");
			yield* reload();
			if (refreshed) {
				yield* refresh();
			}
		},
	);
}

export function typedThenRefreshed() {
	return drafts.trait("screen", "the draft name Local merged with a query refresh to Remote / 350", function* (engine) {
		yield* openWith(engine, { key: "order-draft" });
		const { refresh, type } = verbs(engine);
		yield* type("name", "Local");
		yield* refresh();
	});
}

export function firstSessionDraft(step: "hidden" | "replaced" | "second typed" | "stored") {
	const described = {
		hidden: "the first session's draft First session with its form hidden",
		replaced: "the first session's draft First session dropped by a session replacement while hidden",
		"second typed": "the second session typing Second session after replacing the first session's draft",
		stored: "a stored draft First session written by the first session",
	}[step];
	return drafts.trait("screen", described, function* (engine) {
		yield* openWith(engine, { key: "order-draft" });
		const { hideForm, session, type } = verbs(engine);
		yield* type("name", "First session");
		if (step === "stored") {
			yield* Effect.promise(current(engine.state).unmount);
			delete engine.state.view;
			return;
		}
		yield* hideForm();
		if (step === "hidden") {
			return;
		}
		yield* session("second", false);
		if (step === "replaced") {
			return;
		}
		yield* session("second");
		yield* type("name", "Second session");
	});
}

export function unavailableStorage(failure: "getter" | "read" | "write" | "remove") {
	return drafts.trait(
		"screen",
		`a persisted draft editor whose storage ${failure === "getter" ? "cannot be reached" : `fails every ${failure}`}`,
		function* (engine) {
			function deny(operation: string) {
				if (failure === operation) {
					throw new Error("Denied");
				}
			}
			const storage = {
				getItem: vi.fn(() => {
					deny("read");
					return null;
				}),
				removeItem: vi.fn(() => deny("remove")),
				setItem: vi.fn(() => deny("write")),
			};
			const getStorage = vi.fn(() => {
				deny("getter");
				return storage;
			});
			engine.state.storage = getStorage;
			yield* openWith(engine, { key: "unavailable", storage: getStorage });
			yield* verbs(engine).type("name", "Local");
		},
	);
}

export function storedDraft(raw: string) {
	return drafts.trait("screen", `the stored draft ${raw.length > 40 ? `${raw.slice(0, 40)}…` : raw}`, () =>
		Effect.sync(() => window.localStorage.setItem("order-draft", raw)),
	);
}

export function saveHeld(laterEdit: boolean) {
	return drafts.trait(
		"screen",
		`a held save of Submitted followed by ${laterEdit ? "the later edit Later edit and " : ""}a query refresh to Remote / 350`,
		function* (engine) {
			yield* openWith(engine, { key: "order-draft" }, "held");
			const { refresh, submit, type } = verbs(engine);
			yield* type("name", "Submitted");
			yield* submit();
			if (laterEdit) {
				yield* type("name", "Later edit");
			}
			yield* refresh();
		},
	);
}

export function laterEditSaved() {
	return drafts.trait("screen", "the later edit Later edit kept after the held save of Submitted succeeded", function* (engine) {
		yield* openWith(engine, { key: "order-draft" }, "held");
		const { finishSave, refresh, submit, type } = verbs(engine);
		yield* type("name", "Submitted");
		yield* submit();
		yield* type("name", "Later edit");
		yield* refresh();
		yield* finishSave();
	});
}

export function activityDraft(step: "hidden" | "revealed") {
	return drafts.trait(
		"screen",
		`the draft name Retained with Activity ${step === "hidden" ? "hidden" : "hidden and revealed again"}`,
		function* (engine) {
			yield* openWith(engine, { key: "order-draft" });
			const { activity, type } = verbs(engine);
			yield* type("name", "Retained");
			yield* activity("hidden");
			if (step === "revealed") {
				yield* activity("visible");
			}
		},
	);
}
